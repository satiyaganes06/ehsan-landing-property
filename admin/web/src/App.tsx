import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './lib/toast';
import { Shell } from './components/Shell';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ProjectList } from './pages/projects/List';
import { ProjectEdit } from './pages/projects/Edit';
import { EventList } from './pages/events/List';
import { EventEdit } from './pages/events/Edit';
import { Awards } from './pages/awards/Awards';
import { Testimonials } from './pages/testimonials/Testimonials';
import { Blocks } from './pages/blocks/Blocks';
import { MediaLibrary } from './pages/media/Library';
import { EnquiryInbox } from './pages/enquiries/Inbox';
import { Users } from './pages/users/Users';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

function Protected() {
  const { me, loading } = useAuth();
  if (loading) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }} className="dim">Loading…</div>;
  if (!me) return <Navigate to="/login" replace />;
  return <Shell />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<Protected />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/projects" element={<ProjectList />} />
                <Route path="/projects/:id" element={<ProjectEdit />} />
                <Route path="/events" element={<EventList />} />
                <Route path="/events/:id" element={<EventEdit />} />
                <Route path="/awards" element={<Awards />} />
                <Route path="/testimonials" element={<Testimonials />} />
                <Route path="/blocks" element={<Blocks />} />
                <Route path="/media" element={<MediaLibrary />} />
                <Route path="/enquiries" element={<EnquiryInbox />} />
                <Route path="/users" element={<Users />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
