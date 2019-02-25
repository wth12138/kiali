import { JaegerActions } from './JaegerActions';

import * as Api from '../services/Api';

import { ServiceOverview } from '../types/ServiceList';
import { KialiAppState } from '../store/Store';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppAction } from './KialiAppAction';
import { JAEGER_QUERY } from '../config';
import logfmtParser from 'logfmt/lib/logfmt_parser';
import moment from 'moment';

export const convTagsLogfmt = (tags: string) => {
  if (!tags) {
    return null;
  }
  const data = logfmtParser.parse(tags);
  Object.keys(data).forEach(key => {
    const value = data[key];
    // make sure all values are strings
    // https://github.com/jaegertracing/jaeger/issues/550#issuecomment-352850811
    if (typeof value !== 'string') {
      data[key] = String(value);
    }
  });
  return JSON.stringify(data);
};

export class JaegerURLSearch {
  url: string;

  constructor(url: string) {
    this.url = `${url}${JAEGER_QUERY().PATH}?${JAEGER_QUERY().EMBED.UI_EMBED}=${JAEGER_QUERY().EMBED.VERSION}`;
  }

  addQueryParam(param: string, value: string | number) {
    this.url += `&${param}=${value}`;
  }

  addParam(param: string) {
    this.url += `&${param}`;
  }
}

export const getUnixTimeStampInMSFromForm = (
  startDate: string,
  startDateTime: string,
  endDate: string,
  endDateTime: string
) => {
  const start = `${startDate} ${startDateTime}`;
  const end = `${endDate} ${endDateTime}`;
  return {
    start: `${moment(start, 'YYYY-MM-DD HH:mm').valueOf()}000`,
    end: `${moment(end, 'YYYY-MM-DD HH:mm').valueOf()}000`
  };
};

export const JaegerThunkActions = {
  asyncFetchServices: (ns: string) => {
    return (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>, getState: () => KialiAppState) => {
      if (getState()['authentication']['token'] === undefined) {
        return Promise.resolve();
      }
      /** Get the token storage in redux-store */
      const token = getState().authentication.session!.token;
      /** generate Token */
      const auth = `Bearer ${token}`;

      // Dispatch a thunk from thunk!
      dispatch(JaegerActions.requestStarted());
      return Api.getServices(auth, ns)
        .then(response => response['data'])
        .then(data => {
          const serviceList: string[] = [];
          data['services'].forEach((aService: ServiceOverview) => {
            serviceList.push(aService.name);
          });
          dispatch(JaegerActions.receiveList(serviceList));
        })
        .catch(() => dispatch(JaegerActions.requestFailed()));
    };
  },
  getSearchURL: () => {
    return (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>, getState: () => KialiAppState) => {
      const searchOptions = getState().jaegerState.search;
      const jaegerOptions = JAEGER_QUERY().OPTIONS;
      const urlRequest = new JaegerURLSearch(getState().jaegerState.jaegerURL);

      // Search options
      urlRequest.addQueryParam(jaegerOptions.START_TIME, searchOptions.start);
      urlRequest.addQueryParam(jaegerOptions.END_TIME, searchOptions.end);
      urlRequest.addQueryParam(jaegerOptions.LIMIT_TRACES, searchOptions.limit);
      urlRequest.addQueryParam(jaegerOptions.LOOKBACK, searchOptions.lookback);
      urlRequest.addQueryParam(jaegerOptions.MAX_DURATION, searchOptions.maxDuration);
      urlRequest.addQueryParam(jaegerOptions.MIN_DURATION, searchOptions.minDuration);
      urlRequest.addQueryParam(
        jaegerOptions.SERVICE_SELECTOR,
        searchOptions.serviceSelected + '.' + searchOptions.namespaceSelected
      );
      const logfmtTags = convTagsLogfmt(searchOptions.tags);
      if (logfmtTags) {
        urlRequest.addQueryParam(jaegerOptions.TAGS, logfmtTags);
      }

      // Embed Options
      const traceOptions = getState().jaegerState.trace;

      // Rename query params for 1.9 Jaeger
      urlRequest.addQueryParam(JAEGER_QUERY().EMBED.UI_TRACE_HIDE_MINIMAP, traceOptions.hideMinimap ? '1' : '0');
      urlRequest.addQueryParam(JAEGER_QUERY().EMBED.UI_SEARCH_HIDE_GRAPH, searchOptions.hideGraph ? '1' : '0');
      urlRequest.addQueryParam(JAEGER_QUERY().EMBED.UI_TRACE_HIDE_SUMMARY, traceOptions.hideSummary ? '1' : '0');

      return dispatch(JaegerActions.setSearchRequest(urlRequest.url));
    };
  },
  setCustomLookback: (startDate: string, startTime: string, endDate: string, endTime: string) => {
    return (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>, getState: () => KialiAppState) => {
      if (getState().jaegerState.search.lookback === 'custom') {
        const toTimestamp = getUnixTimeStampInMSFromForm(startDate, startTime, endDate, endTime);
        dispatch(JaegerActions.setCustomLookback(toTimestamp.start, toTimestamp.end));
      }
    };
  }
};
