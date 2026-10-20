import { createRoot } from "react-dom/client";
import App from "./App";
import Widget from "./Widget";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  location.pathname === "/widget" ? <Widget standalone /> : <App />,
);
