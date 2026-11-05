import { createRoot } from "react-dom/client";
import { StoreProvider } from "./store";
import App from "./App";
import "./styles.css";
import "@fontsource-variable/manrope/wght.css";
import "@fontsource-variable/dm-sans/wght.css";
createRoot(document.getElementById("root")!).render(
  <StoreProvider>
    <App />
  </StoreProvider>,
);
