import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeABTests } from "./lib/abTesting";

createRoot(document.getElementById("root")!).render(<App />);
