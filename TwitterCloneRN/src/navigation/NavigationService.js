import React from 'react';

let _navigator;

function setTopLevelNavigator(navigatorRef) {
  _navigator = navigatorRef;
}

function navigate(routeName, params) {
  _navigator?.navigate(routeName, params);
}

function goBack() {
  _navigator?.goBack();
}

function reset(routeName, params) {
  _navigator?.reset({
    index: 0,
    routes: [{ name: routeName, params }],
  });
}

export const navigationRef = React.createRef();

export default {
  navigate,
  goBack,
  reset,
  setTopLevelNavigator,
};