import _ from 'lodash';
import { push } from 'connected-react-router';
import { getLocators, APP_MODE } from '../components/Inspector/shared';
import { xmlToJSON } from '../util';
import frameworks from '../lib/client-frameworks';
import { getSetting, setSetting, SAVED_FRAMEWORK } from '../../shared/settings';
import i18n from '../../configs/i18next.config.renderer';
import AppiumClient from '../lib/appium-client';
import { notification } from 'antd';

export const SET_SESSION_DETAILS = 'SET_SESSION_DETAILS';
export const SET_SOURCE_AND_SCREENSHOT = 'SET_SOURCE_AND_SCREENSHOT';
export const SESSION_DONE = 'SESSION_DONE';
export const SELECT_ELEMENT = 'SELECT_ELEMENT';
export const UNSELECT_ELEMENT = 'UNSELECT_ELEMENT';
export const SET_SELECTED_ELEMENT_ID = 'SET_SELECTED_ELEMENT_ID';
export const SET_INTERACTIONS_NOT_AVAILABLE = 'SET_INTERACTIONS_NOT_AVAILABLE';
export const METHOD_CALL_REQUESTED = 'METHOD_CALL_REQUESTED';
export const METHOD_CALL_DONE = 'METHOD_CALL_DONE';
export const SET_FIELD_VALUE = 'SET_FIELD_VALUE';
export const SET_EXPANDED_PATHS = 'SET_EXPANDED_PATHS';
export const SELECT_HOVERED_ELEMENT = 'SELECT_HOVERED_ELEMENT';
export const UNSELECT_HOVERED_ELEMENT = 'UNSELECT_HOVERED_ELEMENT';
export const SHOW_SEND_KEYS_MODAL = 'SHOW_SEND_KEYS_MODAL';
export const HIDE_SEND_KEYS_MODAL = 'HIDE_SEND_KEYS_MODAL';
export const QUIT_SESSION_REQUESTED = 'QUIT_SESSION_REQUESTED';
export const QUIT_SESSION_DONE = 'QUIT_SESSION_DONE';

export const CLOSE_RECORDER = 'CLOSE_RECORDER';
export const SET_ACTION_FRAMEWORK = 'SET_ACTION_FRAMEWORK';
export const RECORD_ACTION = 'RECORD_ACTION';
export const SET_SHOW_BOILERPLATE = 'SET_SHOW_BOILERPLATE';

export const SHOW_LOCATOR_TEST_MODAL = 'SHOW_LOCATOR_TEST_MODAL';
export const HIDE_LOCATOR_TEST_MODAL = 'HIDE_LOCATOR_TEST_MODAL';
export const SET_LOCATOR_TEST_STRATEGY = 'SET_LOCATOR_TEST_STRATEGY';
export const SET_LOCATOR_TEST_VALUE = 'SET_LOCATOR_TEST_VALUE';
export const SEARCHING_FOR_ELEMENTS = 'SEARCHING_FOR_ELEMENTS';
export const SEARCHING_FOR_ELEMENTS_COMPLETED = 'SEARCHING_FOR_ELEMENTS_COMPLETED';
export const GET_FIND_ELEMENTS_TIMES = 'GET_FIND_ELEMENTS_TIMES';
export const GET_FIND_ELEMENTS_TIMES_COMPLETED = 'GET_FIND_ELEMENTS_TIMES_COMPLETED';
export const SET_LOCATOR_TEST_ELEMENT = 'SET_LOCATOR_TEST_ELEMENT';
export const CLEAR_SEARCH_RESULTS = 'CLEAR_SEARCH_RESULTS';
export const ADD_ASSIGNED_VAR_CACHE = 'ADD_ASSIGNED_VAR_CACHE';
export const CLEAR_ASSIGNED_VAR_CACHE = 'CLEAR_ASSIGNED_VAR_CACHE';
export const SET_SCREENSHOT_INTERACTION_MODE = 'SET_SCREENSHOT_INTERACTION_MODE';
export const SET_APP_MODE = 'SET_APP_MODE';
export const SET_SEARCHED_FOR_ELEMENT_BOUNDS = 'SET_SEARCHED_FOR_ELEMENT_BOUNDS';
export const CLEAR_SEARCHED_FOR_ELEMENT_BOUNDS = 'CLEAR_SEARCHED_FOR_ELEMENT_BOUNDS';

export const SET_SWIPE_START = 'SET_SWIPE_START';
export const SET_SWIPE_END = 'SET_SWIPE_END';
export const CLEAR_SWIPE_ACTION = 'CLEAR_SWIPE_ACTION';
export const PROMPT_KEEP_ALIVE = 'PROMPT_KEEP_ALIVE';
export const HIDE_PROMPT_KEEP_ALIVE = 'HIDE_PROMPT_KEEP_ALIVE';

export const SELECT_INTERACTION_MODE = 'SELECT_INTERACTION_MODE';

export const SELECT_ACTION_GROUP = 'SELECT_ACTION_GROUP';
export const SELECT_SUB_ACTION_GROUP = 'SELECT_SUB_ACTION_GROUP';

export const ENTERING_ACTION_ARGS = 'ENTERING_ACTION_ARGS';
export const REMOVE_ACTION = 'REMOVE_ACTION';
export const SET_ACTION_ARG = 'SET_ACTION_ARG';

export const SET_CONTEXT = 'SET_CONTEXT';

export const SET_KEEP_ALIVE_INTERVAL = 'SET_KEEP_ALIVE_INTERVAL';
export const SET_USER_WAIT_TIMEOUT = 'SET_USER_WAIT_TIMEOUT';
export const SET_LAST_ACTIVE_MOMENT = 'SET_LAST_ACTIVE_MOMENT';

export const SET_VISIBLE_COMMAND_RESULT = 'SET_VISIBLE_COMMAND_RESULT';

const KEEP_ALIVE_PING_INTERVAL = 5 * 1000;
const NO_NEW_COMMAND_LIMIT = 24 * 60 * 60 * 1000; // Set timeout to 24 hours
const WAIT_FOR_USER_KEEP_ALIVE = 60 * 60 * 1000; // Give user 1 hour to reply

// A debounced function that calls findElement and gets info about the element
const findElement = _.debounce(async function (strategyMap, dispatch, getState, path) {
  for (let [strategy, selector] of strategyMap) {
    // Get the information about the element
    const action = callClientMethod({
      strategy,
      selector,
    });
    let {elementId, variableName, variableType} = await action(dispatch, getState);

    // Set the elementId, variableName and variableType for the selected element
    // (check first that the selectedElementPath didn't change, to avoid race conditions)
    if (elementId && getState().inspector.selectedElementPath === path) {
      return dispatch({type: SET_SELECTED_ELEMENT_ID, elementId, variableName, variableType});
    }
  }

  return dispatch({type: SET_INTERACTIONS_NOT_AVAILABLE});
}, 1000);

export function selectElement (path) {
  return async (dispatch, getState) => {
    // Set the selected element in the source tree
    dispatch({type: SELECT_ELEMENT, path});
    const state = getState().inspector;
    const {attributes: selectedElementAttributes, xpath: selectedElementXPath} = state.selectedElement;
    const {sourceXML} = state;

    // Expand all of this element's ancestors so that it's visible in the source tree
    let {expandedPaths} = getState().inspector;
    let pathArr = path.split('.').slice(0, path.length - 1);
    while (pathArr.length > 1) {
      pathArr.splice(pathArr.length - 1);
      let path = pathArr.join('.');
      if (expandedPaths.indexOf(path) < 0) {
        expandedPaths.push(path);
      }
    }
    dispatch({type: SET_EXPANDED_PATHS, paths: expandedPaths});


    // Find the optimal selection strategy. If none found, fall back to XPath.
    const strategyMap = _.toPairs(getLocators(selectedElementAttributes, sourceXML));
    strategyMap.push(['xpath', selectedElementXPath]);

    // Debounce find element so that if another element is selected shortly after, cancel the previous search
    await findElement(strategyMap, dispatch, getState, path);
  };
}

export function unselectElement () {
  return (dispatch) => {
    dispatch({type: UNSELECT_ELEMENT});
  };
}

export function selectHoveredElement (path) {
  return (dispatch) => {
    dispatch({type: SELECT_HOVERED_ELEMENT, path});
  };
}

export function unselectHoveredElement (path) {
  return (dispatch) => {
    dispatch({type: UNSELECT_HOVERED_ELEMENT, path});
  };
}

/**
 * Requests a method call on appium
 */
export function applyClientMethod (params) {
  return async (dispatch, getState) => {
    const isRecording = params.methodName !== 'quit' &&
                      params.methodName !== 'getPageSource' &&
                      getState().inspector.isRecording;
    try {
      dispatch({type: METHOD_CALL_REQUESTED});
      const callAction = callClientMethod(params);
      let {contexts, contextsError, currentContext, currentContextError,
             source, screenshot, windowSize, result, sourceError,
             screenshotError, windowSizeError, variableName,
             variableIndex, strategy, selector} = await callAction(dispatch, getState);
      source = '<hierarchy rotation="0"><node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,0][824,1688]"><node index="0" text="" resource-id="" class="android.widget.LinearLayout" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,0][824,1688]"><node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,0][824,1688]"><node index="0" text="" resource-id="com.lambdatest.sampleapp:id/action_bar_root" class="android.widget.LinearLayout" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,0][824,1688]"><node index="0" text="" resource-id="android:id/content" class="android.widget.FrameLayout" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,0][824,1688]"><node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,0][824,1688]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,0][824,1688]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,0][824,160]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[20,78][72,131]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[20,78][72,131]"><node index="0" text="" resource-id="" class="android.widget.TextView" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[20,78][72,131]" /></node></node><node index="1" text="LambdaTest sample app" resource-id="" class="android.widget.TextView" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[190,77][635,131]" /><node index="2" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[752,78][804,131]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[752,78][804,131]"><node index="0" text="" resource-id="" class="android.widget.TextView" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[752,78][804,131]" /></node></node></node><node index="1" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,160][824,240]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[20,160][804,224]"><node index="0" text="What needs to be done?" resource-id="" class="android.widget.EditText" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="true" password="false" selected="false" bounds="[32,160][804,224]" /></node><node index="1" text="" resource-id="" class="android.widget.TextView" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[30,234][794,240]" /></node><node index="2" text="" resource-id="" class="android.widget.ScrollView" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,240][824,1688]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,240][824,492]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,240][824,366]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,240][824,366]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,240][824,366]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,240][824,366]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[32,272][92,333]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[32,272][92,333]"><node index="0" text="" resource-id="" class="android.widget.TextView" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[32,272][92,333]" /></node></node><node index="1" text="This is a sample app" resource-id="" class="android.widget.TextView" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[124,281][418,324]" /></node></node></node><node index="1" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,240][824,366]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[704,240][824,366]"><node index="0" text="Delete" resource-id="" class="android.widget.TextView" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[725,284][804,322]" /></node></node></node><node index="1" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,366][824,492]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,366][824,492]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,366][824,492]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,366][824,492]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[32,398][92,459]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[32,398][92,459]"><node index="0" text="" resource-id="" class="android.widget.TextView" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[32,398][92,459]" /></node></node><node index="1" text="Add items to start testing" resource-id="" class="android.widget.TextView" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[124,407][485,450]" /></node></node></node><node index="1" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,366][824,492]"><node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[704,366][824,492]"><node index="0" text="Delete" resource-id="" class="android.widget.TextView" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[725,410][804,448]" /></node></node></node></node></node></node></node></node></node></node></node><node index="1" text="" resource-id="android:id/statusBarBackground" class="android.view.View" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,0][824,48]" /><node index="2" text="" resource-id="android:id/navigationBarBackground" class="android.view.View" package="com.lambdatest.sampleapp" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,0][0,0]" /></node></hierarchy>'
      console.log("screenshot...", screenshot)
      screenshot = "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NlrtRhSr4vfRE1EU2VwifvBZO14+2h1074bqdhf+Yk8n/u5AF67KpPKcmqOXzYwzUt3scuN7n7TjnXM9sNjlF6AfqXPguY/b8XkYc+n/7kAX/npvl+xeGSK8Gdd+tK0DWy72ok1mkbKcWG0Xlwf4f/Z14fmP27C3xo4ue/Cft8nqwTvnerDxg9aQncK9NXY89VEb3jnXEzKTldsDnGl04m8PdOH5T9pDHgsA//OgBS8d6UZzj/xxdplRmHApXeZYvR6Gw+kW8b1Pvfdpt8yaKZtLxO5rdjz5YRtO3FJ2M1c1ruNwRKqd1azbaLYbUSwSJv+2Yeh/bYgoLLPyDZiQpYPZIKDLLuJ8s3PY+7qMZCadgCWlRm+HQACarW4crXOi0Tq0p4rTcvUYn6lDmkmDLruI040OXBxGVq4+sdouOg0w93Zq2DSTBgKATrsHl1tdAZnpwjUhS4dJ2XqkmDTQa7y7vN+yuHH8lnNIU4OMWgFzCw0Yk66FUSfAYhdxrcM15GlKkShzrF4Pwex4KgsF/Trl9RY3Vm9uAeC9T5eWGlGQogVEoMHqxqGbDrSH+cBguNS4jsOhRDurWbcjvd0o/pn1Asb221upqs0VdPR+JGKAQ0REFIcG6ijT0KlZt2w3ouHjFDUiIiIiIoobDHCIiIiIiChuMMAhIiIiIqK4wQCHiIiIiIjiBgMcIiIiIiKKGwxwiIiIiIgobjBNNBERURyakKWDQSv4veZwi4rsIXW3U7Nu2W5Ew8cAh4iIiIiI4ganqBERERERUdxggENERERERHGDAQ4REREREcUNBjhERERERBQ3GOAQEREREVHcYIBDRERERERxgwEOERERERHFDQY4REREREQUNxjgEBERERFR3GCAQ0REREREcYMBDhERERERxQ0GOEREREREFDcY4BARERERUdxggENERERERHGDAQ4REREREcUNBjhERERERBQ3GOAQEREREVHcYIBDRERERERxgwEOERERERHFDQY4REREREQUNxjgEBERERFR3GCAQ0REREREcYMBDhERERERxQ0GOEREREREFDcY4BARERERUdxggENERERERHGDAQ4REREREcUNBjhERERERBQ3GOAQEREREVHcYIBDRERERERxQxetDzYbBCwrNWJOgQEVWToUJmuRbNRAI0SrRERERERENFgeEbDYPaizuFHZ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PeDExwTf/TdlmsW4H/TnFdWd2bL/9a9/6eLFi5Kk22+/3fm8xWLRnXfeqdmzZ+vEiRP66quvNGDAAK/rWbFihb7//ntJ0rXXXqt3331XMTH/GWWuX79+uu222zRp0iT98MMPfl9PdV177bXOx2UHSpLUt29fNWvWzG355ORk50Fenz59tGjRIpfr9Lt166bevXtr1KhRKikp0axZs7Ru3Tqvl44NGTJEc+fOdTmA79+/v4YPH66kpCTl5OQoJSVFkvTMM89o/PjxLu9PTEzUq6++6qxp06ZNbgFn6dKlzsdz5sxxObju1KmTBg8erOnTp+uTTz5Rdna21q9frwkTJnjpMVdV7b8dO3bof//3fyWVHiS///77LmGqU6dO+sUvfqG//OUvWrdunTPseTsz5U1N2lzVNr3zzjvKzc2VJD333HO66667nK+1atVKPXr0UJs2bfTggw9Kkv75z39WGHAaN26st956S9ddd53ba1WtzZva2O8D+ZlURUxMjBYvXqwePXo4n7v22ms1dOhQJSUlKSMjQ6mpqTp8+LC6dXO9FnnlypXOy3179eqlpUuXuvRL//79NWLECN177706dOhQjeoEAHgWlKmhoNg1HFhCpMjQIBof+jJhltJ/5eXXoYCzevVqSVJYWJgSExNdXrv11ludj8tfxnY5u92uf/zjH86fn376aZdQUqZ58+b661//6vf1BNIrr7zifPz88897vAm5a9euGj16tCTp+++/dwYUTx577DGPZyfi4+NdDpSvvfZar5fpjRkzxvnY02StZc9ZLBYNHjzY7XWLxaIpU6Y4fz5w4IDXemvqrbfecj5+/vnnPZ4pCgsL0xNPPKGGDRtKkv7+978rJyenStsJZJsLCwt100036eabb9aoUaM8LjNy5Ejn5/zFF19UuL5nn33WY7ipTb7Y74NpPyzv+eefdwk3ZerXr+/yu3X06FGX1x0Oh5YtW+b8+amnnvLYL82bN9cLL7zgw4oBAOUFZcBx1J1s4FXwxjFXJ06c0M6dOyWVHnBdfnCZkJDgPGvz4YcferzfQ5LS09OVlpYmSerdu7fbGYPyWrZs6fU1X60nUDIyMvTVV19JkgYPHqxOnTp5XXbEiBHOx3v37vW6XJMmTby+lpCQ4HycmJjodYSp8t9gnz171u31sm+87Xa7jhw54nEdPXr00Ndff62vv/5a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gAMAAADAGAQcAAAAAMYg4AAAAAAwBgEHAAAAgDEIOAAAAACMQcABAAAAYAwCDgAAAABjEHAAAAAAGIOAAwAAAMAYBBwAAAAAxiDgAAAAADAGAQcAAACAMQg4AAAAAIxBwAEAAABgDAIOAAAAAGMQcAAAAAAYg4ADAAAAwBgEHAAAAADGIOAAAAAAMAYBBwAAAIAxCDgAAAAAjEHAAQAAAGAMAg4AAAAAYxBwAAAAABiDgAMAAADAGAQcAAAAAMYg4AAAAAAwBgEHAAAAgDEIOAAAAACMQcABAAAAYAwCDgAAAABjEHAAAAAAGIOAAwAAAMAYBBwAAAAAxiDgAAAAADAGAQcAAACAMQg4AAAAAIxBwAEAAABgDAIOAAAAAGMQcAAAAAAYg4ADAAAAwBgEHAAAAADGIOAAAAAAMAYBBwAAAIAxCDgAAAAAjEHAAQAAAGAMAg4AAAAAYxBwAAAAABiDgAMAAADAGAQcAAAAAMYg4AAAAAAwBgEHAAAAgDEIOAAAAACMQcABAAAAYAwCDgAAAABjEHAAAAAAGIOAAwAAAMAYBBwAAAAAxiDgAAAAADAGAQcAAACAMQg4AAAAAIxBwAEAAABgDAIOAAAAAGMQcAAAAAAYg4ADAAAAwBgEHAAAAADGIOAAAAAAMAYBBwAAAIAxCDgAAAAAjEHAAQAAAGAMAg4AAAAAYxBwAAAAABiDgAMAAADAGAQcAAAAAMYg4AAAAAAwBgEHAAAAgDEIOAAAAACMQcABAAAAYAwCDgAAAABjEHAAAAAAGIOAAwAAAMAYBBwAAAAAxiDgAAAAADAGAQcAAACAMQg4AAAAAIxBwAEAAABgDAIOAAAAAGMQcAAAAAAYg4ADAAAAwBgEHAAAAADGIOAAAAAAMAYBBwAAAIAxCDgAAAAAjEHAAQAAAGAMAg4AAAAAYxBwAAAAABiDgAMAAADAGAQcAAAAAMYg4AAAAAAwBgEHAAAAgDEIOAAAAACMQcABAAAAYAwCDgAAAABjEHAAAAAAGIOAAwAAAMAYBBwAAAAAxiDgAAAAADAGAQcAAACAMQg4AAAAAIxBwAEAAABgDAIOAAAAAGMQcAAAAAAYg4ADAAAAwBgEHAAAAADGIOAAAAAAMAYBBwAAAIAxCDgAAAAAjEHAAQAAAGAMAg4AAAAAYxBwAAAAABiDgAMAAADAGAQcAAAAAMYg4AAAAAAwBgEHAAAAgDEIOAAAAACMQcABAAAAYAwCDgAAAABjEHAAAAAAGIOAAwAAAMAYBBwAAAAAxiDgAAAAADAGAQcAAACAMQg4AAAAAIxBwAEAAABgDAIOAAAAAGMQcAAAAAAYg4ADAAAAwBgEHAAAAADGIOAAAAAAMAYBBwAAAIAxCDgAAAAAjEHAAQAAAGAMAg4AAAAAYxBwAAAAABiDgAMAAADAGAQcAAAAAMYg4AAAAAAwBgEHAAAAgDEIOAAAAACMQcABAAAAYAwCDgAAAABjEHAAAAAAGIOAAwAAAMAYBBwAAAAAxiDgAAAAADAGAQcAAACAMQg4AAAAAIxBwAEAAABgDAIOAAAAAGMQcAAAAAAYg4ADAAAAwBgEHAAAAADGIOAAAAAAMAYBBwAAAIAxCDgAAAAAjEHAAQAAAGAMAg4AAAAAYxBwAAAAABiDgAMAAADAGAQcAAAAAMYg4AAAAAAwBgEHAAAAgDEIOAAAAACMQcABAAAAYAwCDgAAAABjEHAAAAAAGIOAAwAAAMAYBBwAAAAAxiDgAAAAADAGAQcAAACAMQg4AAAAAIxBwAEAAABgDAIOAAAAAGMQcAAAAAAYg4ADAAAAwBgEHAAAAADGIOAAAAAAMAYBBwAAAIAxCDgAAAAAjEHAAQAAAGAMAg4AAAAAYxBwAAAAABiDgAMAAADAGAQcAAAAAMYg4AAAAAAwBgEHAAAAgDEIOAAAAACM8f/bu38Qu8p9AcPfkIvEkWgxYqM7IsJgowS0MINYuO0MkkQiKIraSFIHbAwhGAURg4Vg7ESCFv7prNQ0gomloIVERCQpRNyCEo0Iklucc+XCOd7rHDOzJ+88Tzl7Zn2/ZrPn3WutbwkcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAAyBA4AABAhsABAAAyBA4AAJAhcAAAgAyBAwAAZAgcAAAgQ+AAAAAZAgcAAMgQOAAAQIbAAQAAMgQOAACQIXAAAIAMgQMAAGQIHAAAIEPgAAAAGQIHAADIEDgAAECGwAEAADIEDgAAkCFwAACADIEDAABkCBwAACBD4AAAABkCBwAA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"
      if (isRecording) {
        // Add 'findAndAssign' line of code. Don't do it for arrays though. Arrays already have 'find' expression
        if (strategy && selector && !variableIndex && variableIndex !== 0) {
          const findAction = findAndAssign(strategy, selector, variableName, false);
          findAction(dispatch, getState);
        }

        // now record the actual action
        let args = [variableName, variableIndex];
        args = args.concat(params.args || []);
        dispatch({type: RECORD_ACTION, action: params.methodName, params: args });
      }
      dispatch({type: METHOD_CALL_DONE});

      if (source && screenshot) {
        dispatch({
          type: SET_SOURCE_AND_SCREENSHOT,
          contexts,
          currentContext,
          source: source && xmlToJSON(source),
          sourceXML: source,
          screenshot,
          windowSize,
          contextsError,
          currentContextError,
          sourceError,
          screenshotError,
          windowSizeError,
        });
      }
      return result;
    } catch (error) {
      console.log(error); // eslint-disable-line no-console
      let methodName = params.methodName === 'click' ? 'tap' : params.methodName;
      console.log(error)
      dispatch({type: METHOD_CALL_DONE});
    }
  };
}

export function addAssignedVarCache (varName) {
  return (dispatch) => {
    dispatch({type: ADD_ASSIGNED_VAR_CACHE, varName});
  };
}

export function showSendKeysModal () {
  return (dispatch) => {
    dispatch({type: SHOW_SEND_KEYS_MODAL});
  };
}

export function hideSendKeysModal () {
  return (dispatch) => {
    dispatch({type: HIDE_SEND_KEYS_MODAL});
  };
}

/**
 * Set a value of an arbitrarily named field
 */
export function setFieldValue (name, value) {
  return (dispatch) => {
    dispatch({type: SET_FIELD_VALUE, name, value});
  };
}

export function setExpandedPaths (paths) {
  return (dispatch) => {
    dispatch({type: SET_EXPANDED_PATHS, paths});
  };
}

/**
 * Quit the session and go back to the new session window
 */
export function quitSession (reason, killedByUser = true) {
  return async (dispatch, getState) => {
    const killAction = killKeepAliveLoop();
    killAction(dispatch, getState);
    const applyAction = applyClientMethod({methodName: 'quit'});
    await applyAction(dispatch, getState);
    dispatch({type: QUIT_SESSION_DONE});
    dispatch(push('/session'));
    if (!killedByUser) {
      notification.error({
        message: 'Error',
        description: reason || i18n.t('Session has been terminated'),
        duration: 0
      });
    }
  };
}

export function startRecording () {
  return (dispatch) => {
    dispatch({type: START_RECORDING});
  };
}

export function pauseRecording () {
  return (dispatch) => {
    dispatch({type: PAUSE_RECORDING});
  };
}

export function clearRecording () {
  return (dispatch) => {
    dispatch({type: CLEAR_RECORDING});
    dispatch({type: CLEAR_ASSIGNED_VAR_CACHE}); // Get rid of the variable cache
  };
}

export function getSavedActionFramework () {
  return async (dispatch) => {
    let framework = await getSetting(SAVED_FRAMEWORK);
    dispatch({type: SET_ACTION_FRAMEWORK, framework});
  };
}

export function setActionFramework (framework) {
  return async (dispatch) => {
    if (!frameworks[framework]) {
      throw new Error(i18n.t('frameworkNotSupported', {framework}));
    }
    await setSetting(SAVED_FRAMEWORK, framework);
    dispatch({type: SET_ACTION_FRAMEWORK, framework});
  };
}

export function recordAction (action, params) {
  return (dispatch) => {
    dispatch({type: RECORD_ACTION, action, params});
  };
}

export function closeRecorder () {
  return (dispatch) => {
    dispatch({type: CLOSE_RECORDER});
  };
}

export function toggleShowBoilerplate () {
  return (dispatch, getState) => {
    const show = !getState().inspector.showBoilerplate;
    dispatch({type: SET_SHOW_BOILERPLATE, show});
  };
}

export function setSessionDetails (driver, sessionDetails) {
  return (dispatch) => {
    dispatch({type: SET_SESSION_DETAILS, driver, sessionDetails});
  };
}

export function showLocatorTestModal () {
  return (dispatch) => {
    dispatch({type: SHOW_LOCATOR_TEST_MODAL});
  };
}

export function hideLocatorTestModal () {
  return (dispatch) => {
    dispatch({type: HIDE_LOCATOR_TEST_MODAL});
    dispatch({type: CLEAR_SEARCHED_FOR_ELEMENT_BOUNDS});
  };
}

export function setLocatorTestValue (locatorTestValue) {
  return (dispatch) => {
    dispatch({type: SET_LOCATOR_TEST_VALUE, locatorTestValue});
  };
}

export function setLocatorTestStrategy (locatorTestStrategy) {
  return (dispatch) => {
    dispatch({type: SET_LOCATOR_TEST_STRATEGY, locatorTestStrategy});
  };
}

export function setContext (context) {
  return (dispatch) => {
    dispatch({type: SET_CONTEXT, context});
  };
}

export function searchForElement (strategy, selector) {
  return async (dispatch, getState) => {
    dispatch({type: SEARCHING_FOR_ELEMENTS});
    try {
      const callAction = callClientMethod({strategy, selector, fetchArray: true});
      let {elements, variableName} = await callAction(dispatch, getState);
      const findAction = findAndAssign(strategy, selector, variableName, true);
      findAction(dispatch, getState);
      elements = elements.map((el) => el.id);
      dispatch({type: SEARCHING_FOR_ELEMENTS_COMPLETED, elements});
    } catch (error) {
      dispatch({type: SEARCHING_FOR_ELEMENTS_COMPLETED});
      console.log(error)
    }
  };
}

/**
 * Get all the find element times based on the find data source
 */
export function getFindElementsTimes (findDataSource) {
  return async (dispatch, getState) => {
    dispatch({type: GET_FIND_ELEMENTS_TIMES});
    try {
      const findElementsExecutionTimes = [];
      for (const element of findDataSource) {
        const {find, key, selector} = element;
        const action = callClientMethod({strategy: key, selector});
        const {executionTime} = await action(dispatch, getState);
        findElementsExecutionTimes.push({find, key, selector, time: executionTime});
      }

      dispatch({
        type: GET_FIND_ELEMENTS_TIMES_COMPLETED,
        findElementsExecutionTimes: _.sortBy(findElementsExecutionTimes, ['time']),
      });
    } catch (error) {
      dispatch({type: GET_FIND_ELEMENTS_TIMES_COMPLETED});
      console.log(error)
    }
  };
}

export function findAndAssign (strategy, selector, variableName, isArray) {
  return (dispatch, getState) => {
    const {assignedVarCache} = getState().inspector;

    // If this call to 'findAndAssign' for this variable wasn't done already, do it now
    if (!assignedVarCache[variableName]) {
      dispatch({type: RECORD_ACTION, action: 'findAndAssign', params: [strategy, selector, variableName, isArray]});
      dispatch({type: ADD_ASSIGNED_VAR_CACHE, varName: variableName});
    }
  };
}

export function setLocatorTestElement (elementId) {
  return async (dispatch, getState) => {
    dispatch({type: SET_LOCATOR_TEST_ELEMENT, elementId});
    dispatch({type: CLEAR_SEARCHED_FOR_ELEMENT_BOUNDS});
    if (elementId) {
      try {
        const action = callClientMethod({
          methodName: 'getRect',
          args: [elementId],
          skipRefresh: true,
          skipRecord: true,
          ignoreResult: true
        });
        const rect = await action(dispatch, getState);
        dispatch({
          type: SET_SEARCHED_FOR_ELEMENT_BOUNDS,
          location: {x: rect.x, y: rect.y},
          size: {width: rect.width, height: rect.height},
        });
      } catch (ign) { }
    }
  };
}

export function clearSearchResults () {
  return (dispatch) => {
    dispatch({type: CLEAR_SEARCH_RESULTS});
  };
}

export function selectScreenshotInteractionMode (screenshotInteractionMode) {
  return (dispatch) => {
    dispatch({type: SET_SCREENSHOT_INTERACTION_MODE, screenshotInteractionMode });
  };
}

export function selectAppMode (mode) {
  return async (dispatch, getState) => {
    const {appMode} = getState().inspector;
    dispatch({type: SET_APP_MODE, mode});
    // if we're transitioning to hybrid mode, do a pre-emptive search for contexts
    if (appMode !== mode && mode === APP_MODE.WEB_HYBRID) {
      const action = applyClientMethod({methodName: 'getPageSource'});
      await action(dispatch, getState);
    }
  };
}

export function setSwipeStart (swipeStartX, swipeStartY) {
  return (dispatch) => {
    dispatch({type: SET_SWIPE_START, swipeStartX, swipeStartY});
  };
}

export function setSwipeEnd (swipeEndX, swipeEndY) {
  return (dispatch) => {
    dispatch({type: SET_SWIPE_END, swipeEndX, swipeEndY});
  };
}

export function clearSwipeAction () {
  return (dispatch) => {
    dispatch({type: CLEAR_SWIPE_ACTION});
  };
}

export function promptKeepAlive () {
  return (dispatch) => {
    dispatch({type: PROMPT_KEEP_ALIVE});
  };
}

export function hideKeepAlivePrompt () {
  return (dispatch) => {
    dispatch({type: HIDE_PROMPT_KEEP_ALIVE});
  };
}

export function selectActionGroup (group) {
  return (dispatch) => {
    dispatch({type: SELECT_ACTION_GROUP, group});
  };
}

export function selectSubActionGroup (group) {
  return (dispatch) => {
    dispatch({type: SELECT_SUB_ACTION_GROUP, group});
  };
}

export function selectInteractionMode (interaction) {
  return (dispatch) => {
    dispatch({type: SELECT_INTERACTION_MODE, interaction});
  };
}

export function startEnteringActionArgs (actionName, action) {
  return (dispatch) => {
    dispatch({type: ENTERING_ACTION_ARGS, actionName, action});
  };
}

export function cancelPendingAction () {
  return (dispatch) => {
    dispatch({type: REMOVE_ACTION});
  };
}

export function setActionArg (index, value) {
  return (dispatch) => {
    dispatch({type: SET_ACTION_ARG, index, value});
  };
}

/**
 * Ping server every 30 seconds to prevent `newCommandTimeout` from killing session
 */
export function runKeepAliveLoop () {
  return (dispatch, getState) => {
    dispatch({type: SET_LAST_ACTIVE_MOMENT, lastActiveMoment: Date.now()});
    const {driver} = getState().inspector;

    const keepAliveInterval = setInterval(async () => {
      const {lastActiveMoment} = getState().inspector;
      console.log('Pinging Appium server to keep session active'); // eslint-disable-line no-console
      try {
        await driver.getTimeouts(); // Pings the Appium server to keep it alive
      } catch (ign) {}
      const now = Date.now();

      // If the new command limit has been surpassed, prompt user if they want to keep session going
      // Give them WAIT_FOR_USER_KEEP_ALIVE ms to respond
      if (now - lastActiveMoment > NO_NEW_COMMAND_LIMIT) {
        const action = promptKeepAlive();
        action(dispatch);

        // After the time limit kill the session (this timeout will be killed if they keep it alive)
        const userWaitTimeout = setTimeout(() => {
          const action = quitSession('Session closed due to inactivity', false);
          action(dispatch, getState);
        }, WAIT_FOR_USER_KEEP_ALIVE);
        dispatch({type: SET_USER_WAIT_TIMEOUT, userWaitTimeout});
      }
    }, KEEP_ALIVE_PING_INTERVAL);
    dispatch({type: SET_KEEP_ALIVE_INTERVAL, keepAliveInterval});
  };
}

/**
 * Get rid of the intervals to keep the session alive
 */
export function killKeepAliveLoop () {
  return (dispatch, getState) => {
    const {keepAliveInterval, userWaitTimeout} = getState().inspector;
    clearInterval(keepAliveInterval);
    if (userWaitTimeout) {
      clearTimeout(userWaitTimeout);
    }
    dispatch({type: SET_KEEP_ALIVE_INTERVAL, keepAliveInterval: null});
    dispatch({type: SET_USER_WAIT_TIMEOUT, userWaitTimeout: null});
  };
}

/**
 * Reset the new command clock and kill the wait for user timeout
 */
export function keepSessionAlive () {
  return (dispatch, getState) => {
    const {userWaitTimeout} = getState().inspector;
    const action = hideKeepAlivePrompt();
    action(dispatch);
    dispatch({type: SET_LAST_ACTIVE_MOMENT, lastActiveMoment: +(new Date())});
    if (userWaitTimeout) {
      clearTimeout(userWaitTimeout);
      dispatch({type: SET_USER_WAIT_TIMEOUT, userWaitTimeout: null});
    }
  };
}

export function callClientMethod (params) {
  console.log("params...", params)
  return async (dispatch, getState) => {
    console.log(`Calling client method with params:`); // eslint-disable-line no-console
    console.log(params); // eslint-disable-line no-console
    const {driver, appMode} = getState().inspector;
    console.log("getState().inspector", getState().inspector)
    const {methodName, ignoreResult = true} = params;
    params.appMode = appMode;

    const action = keepSessionAlive();
    action(dispatch, getState);
    const client = AppiumClient.instance(driver);
    console.log("client .....", client)
    const res = await client.run(params);
    let {commandRes} = res;

    // Ignore empty objects
    if (_.isObject(res) && _.isEmpty(res)) {
      commandRes = null;
    }

    if (!ignoreResult) {
      // if the user is running actions manually, we want to show the full response with the
      // ability to scroll etc...
      const result = JSON.stringify(commandRes, null, '  ');
      const truncatedResult = _.truncate(result, {length: 2000});
      console.log(`Result of client command was:`); // eslint-disable-line no-console
      console.log(truncatedResult); // eslint-disable-line no-console
      setVisibleCommandResult(result, methodName)(dispatch);
    }
    res.elementId = res.id;
    console.log("resadddasd", res)
    return res;
  };
}

export function setVisibleCommandResult (result, methodName) {
  return (dispatch) => {
    dispatch({type: SET_VISIBLE_COMMAND_RESULT, result, methodName});
  };
}

// export function startSession (desiredCapabilities, attachSessId = null) {
//   return async (dispatch, getState) => {
//     let host, port, username, accessKey, https, path;
//     host = 'mobile-hub.lambdatest.com';
//     port = 443;
//     path = '/wd/hub';
//     // const isProxyChecked = session.server.advanced.useProxy;
//     username = "amanchaturvedi";
//     if (desiredCapabilities.hasOwnProperty('lt:options')) {
//       desiredCapabilities['lt:options'].source = 'appiumdesktop';
//       desiredCapabilities['lt:options'].isRealMobile = true;
//       // if (isProxyChecked) {
//       //   if (session.server.advanced.proxy == undefined) desiredCapabilities['lt:options'].proxyUrl = '';
//       //   else desiredCapabilities['lt:options'].proxyUrl = `${session.server.advanced.proxy}`;
//       // }
//     } else {
//       desiredCapabilities['lambdatest:source'] = 'appiumdesktop';
//       desiredCapabilities['lambdatest:isRealMobile'] = true;
//       // if (isProxyChecked) {
//       //   if (session.server.advanced.proxy == undefined) desiredCapabilities['lambdatest:proxyUrl'] = '';
//       //   else desiredCapabilities['lambdatest:proxyUrl'] = `${session.server.advanced.proxy}`;
//       // }
//     }
//     accessKey = "O4LlvxA7UcaxVqzc1qHOm6I9j0nVqQVPZMsMeS6Y6aT3i4F5Zg";
//     // if (!username || !accessKey) {
//     //   notification.error({
//     //     message: i18n.t('Error'),
//     //     description: i18n.t('lambdatestCredentialsRequired'),
//     //     duration: 4,
//     //   });
//     //   return;
//     // }
//     https = true;

//     // const serverOpts = {
//     //   hostname: host,
//     //   port: parseInt(port, 10),
//     //   protocol: 'https',
//     //   path,
//     //   connectionRetryCount: CONN_RETRIES,
//     // };

//     // if (username && accessKey) {
//     //   serverOpts.user = username;
//     //   serverOpts.key = accessKey;
//     // }

//     // If a newCommandTimeout wasn't provided, set it to 60 * 60 so that sessions don't close on users in short term.
//     // I saw sometimes infinit session timeout was not so good for cloud providers.
//     // So, let me define this value as NEW_COMMAND_TIMEOUT_SEC by default.
//     // if (isUndefined(desiredCapabilities[CAPS_NEW_COMMAND])) {
//     //   desiredCapabilities[CAPS_NEW_COMMAND] = NEW_COMMAND_TIMEOUT_SEC;
//     // }

//     // If someone didn't specify connectHardwareKeyboard, set it to true by
//     // default
//     // if (isUndefined(desiredCapabilities[CAPS_CONNECT_HARDWARE_KEYBOARD])) {
//     //   desiredCapabilities[CAPS_CONNECT_HARDWARE_KEYBOARD] = true;
//     // }

//     // serverOpts.logLevel = process.env.NODE_ENV === 'development' ? 'info' : 'warn';

//     let driver = null;
//     const action = setSessionDetails(driver, {
//       desiredCapabilities,
//       host,
//       port,
//       path,
//       username,
//       accessKey,
//       https,
//     });
//     action(dispatch);
//     dispatch(push('/inspector'));
//   };
// }
