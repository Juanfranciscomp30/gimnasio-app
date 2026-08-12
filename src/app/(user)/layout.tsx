import UserNavbar from '@/components/UserNavbar';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <UserNavbar />
      {children}
    </div>
  );
}