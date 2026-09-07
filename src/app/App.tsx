import { createBrowserRouter, RouterProvider } from "react-router";
import { Root } from "./Root";
import { BlogProvider } from "./context/BlogContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";

const router = createBrowserRouter([
  {
    path: "*",
    Component: Root,
  },
]);

export default function App() {
  return (
    <AdminAuthProvider>
      <BlogProvider>
        <RouterProvider router={router} />
      </BlogProvider>
    </AdminAuthProvider>
  );
}
