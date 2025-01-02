import { createStore, combineReducers, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import { composeWithDevTools } from 'redux-devtools-extension';


import authReducer from './reducers/authReducer';
import postsReducer from './reducers/postsReducer';



const rootReducer = combineReducers({
  auth: authReducer,
  posts: postsReducer,

});

const store = createStore(
  rootReducer,
  composeWithDevTools(applyMiddleware(thunk))
);

export default store;
