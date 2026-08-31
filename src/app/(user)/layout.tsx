import UserNavbar from '@/components/UserNavBar';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <UserNavbar />
      {children}
    </div>
  );
}