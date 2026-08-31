import UserNavbar from '@/components/UserNavBar';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <UserNavbar />
      {/* pb extra en móvil para que la barra de navegación inferior no tape el contenido */}
      <div className="pb-24 sm:pb-0">{children}</div>
    </div>
  );
}
