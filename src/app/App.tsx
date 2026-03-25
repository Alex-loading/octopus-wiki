import { createBrowserRouter, RouterProvider } from "react-router";
import { Root } from "./Root";
import { BlogProvider } from "./context/BlogContext";

const router = createBrowserRouter([
  {
    path: "*",
    Component: Root,
  },
]);

export default function App() {
  return (
    <BlogProvider>
      <RouterProvider router={router} />
    </BlogProvider>
  );
}
