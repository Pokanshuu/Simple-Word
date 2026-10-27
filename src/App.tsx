import { useRoute } from "./lib/router";
import { HomePage } from "./components/home/homePage";
import { EditorPage } from "./components/editor/editorPage";
import { ToastHost } from "./components/ui/toast";
import { DialogHost } from "./components/ui/dialog";

export default function App() {
  const route = useRoute();

  return (
    <>
      {route.page === "home" ? (
        <HomePage />
      ) : (
        <EditorPage session={route.session} />
      )}
      <DialogHost />
      <ToastHost />
    </>
  );
}
