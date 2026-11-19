import { useEffect, useState } from "react";

export default function LiveTimer() {

  const [time, setTime] = useState(0);

  useEffect(() => {

    const interval = setInterval(() => {

      setTime((prev) => prev + 1);

    }, 1000);

    return () => clearInterval(interval);

  }, []);

  const total = Math.floor(Math.max(0, Number(time) || 0));
  const hours = String(Math.floor(total / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");

  return (

    <h1 className="text-5xl md:text-6xl font-black tracking-wider text-slate-800">

      {hours}:{minutes}:{seconds}

    </h1>
  );
}