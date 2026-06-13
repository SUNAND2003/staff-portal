// src/components/AttendanceCard.jsx

export default function AttendanceCard() {
  return (
    <section className="bg-white rounded-3xl shadow-sm p-6 md:p-10 mt-8">

      <h2 className="text-3xl font-bold text-center mb-10">
        Attendance Tracking
      </h2>

      <div className="text-center">

        <h1 className="text-5xl md:text-6xl font-bold text-indigo-600">
          08:24:12
        </h1>

        <p className="text-slate-500 mt-3">
          Working Timer
        </p>

      </div>

      <div className="flex flex-col md:flex-row gap-5 justify-center mt-10">

        <button className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-2xl font-semibold transition">
          Check In
        </button>

        <button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl font-semibold transition">
          Break
        </button>

        <button className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-2xl font-semibold transition">
          Check Out
        </button>

      </div>

    </section>
  )
}