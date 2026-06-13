export default function Button({ text }) {
  return (
    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-semibold transition">
      {text}
    </button>
  )
}