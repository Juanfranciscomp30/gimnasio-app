import Link from 'next/link';

export default function AdminHomePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Panel de administración</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/admin/clases"
          className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition"
        >
          <h2 className="font-semibold mb-1">Clases</h2>
          <p className="text-sm text-gray-600">Ver aforo y asistentes por día</p>
        </Link>
        <Link
          href="/admin/usuarios"
          className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition"
        >
          <h2 className="font-semibold mb-1">Usuarios</h2>
          <p className="text-sm text-gray-600">Gestionar tarifas y alta manual</p>
        </Link>
        <Link
          href="/admin/pagos"
          className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition"
        >
          <h2 className="font-semibold mb-1">Pagos</h2>
          <p className="text-sm text-gray-600">Registrar y consultar pagos</p>
        </Link>
      </div>
    </div>
  );
}