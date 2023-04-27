import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./features/userSlice";
import counterReducer from "./features/countSlice";
// ...

const store = configureStore({
  reducer: {
    counter: counterReducer,
    user: userReducer,
  },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// // Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;
//
export default store;
