export default function App() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Simple Test App</h1>
      <p>If you can see this, React is working!</p>
      <button 
        className="bg-blue-500 text-white px-4 py-2 rounded mt-4"
        onClick={() => alert('React is working!')}
      >
        Test Button
      </button>
    </div>
  );
}