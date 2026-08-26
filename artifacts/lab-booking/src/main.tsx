import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installSecureFetch } from "./lib/secureFetch";

installSecureFetch();
createRoot(document.getElementById("root")!).render(<App />);
