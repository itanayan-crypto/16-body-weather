import { useEffect } from "react";
import BodyWeather from "./components/BodyWeather/BodyWeather.jsx";

// body[data-task] is used by styles/base.css for this task's page background.
const TASK_ID = "16";

export default function App() {
  useEffect(() => {
    document.body.dataset.task = TASK_ID;
    return () => { delete document.body.dataset.task; };
  }, []);

  return (
    <main className="page">
      <div className="page-head">
        <span className="task-chip">Task 16</span>
        <h1 className="page-title">Body Weather</h1>
        <p className="page-sub">Log height, weight, waist, blood sugar and blood pressure to get BMI, diabetes risk and BP status, and track how your body changes over time.</p>
      </div>
      <BodyWeather />
    </main>
  );
}
