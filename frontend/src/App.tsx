import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';

// Academic Management Pages
import { CollegesPage } from './pages/academics/CollegesPage';
import { AcademicYearsPage } from './pages/academics/AcademicYearsPage';
import { ShiftsPage } from './pages/academics/ShiftsPage';
import { WorkingDaysPage } from './pages/academics/WorkingDaysPage';
import { PeriodSlotsPage } from './pages/academics/PeriodSlotsPage';
import { DepartmentsPage } from './pages/academics/DepartmentsPage';
import { SemestersPage } from './pages/academics/SemestersPage';
import { SectionsPage } from './pages/academics/SectionsPage';
import { SubjectsPage } from './pages/academics/SubjectsPage';

// Faculty & Rooms Management Pages
import { FacultyListPage } from './pages/faculty/FacultyListPage';
import { FacultyAvailabilityPage } from './pages/faculty/FacultyAvailabilityPage';
import { QualificationsPage } from './pages/faculty/QualificationsPage';
import { SubjectAllocationPage } from './pages/faculty/SubjectAllocationPage';
import { FacultyWorkloadPage } from './pages/faculty/FacultyWorkloadPage';
import { RoomsPage } from './pages/rooms/RoomsPage';
import { TimetableGenerationPage } from './pages/timetables/TimetableGenerationPage';
import { TimetableListPage } from './pages/timetables/TimetableListPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes cache
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Protected Routes inside AppLayout */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />

              {/* Faculty & Allocations Pages */}
              <Route path="faculty/members" element={<FacultyListPage />} />
              <Route path="faculty/availability" element={<FacultyAvailabilityPage />} />
              <Route path="faculty/qualifications" element={<QualificationsPage />} />
              <Route path="faculty/allocations" element={<SubjectAllocationPage />} />
              <Route path="faculty/workload" element={<FacultyWorkloadPage />} />

              {/* Rooms & Labs */}
              <Route path="rooms" element={<RoomsPage />} />

              {/* Automatic Timetable Generation & Management */}
              <Route path="timetables" element={<TimetableListPage />} />
              <Route path="timetables/generate" element={<TimetableGenerationPage />} />

              {/* Academic Setup Pages */}
              <Route path="academics/colleges" element={<CollegesPage />} />
              <Route path="academics/academic-years" element={<AcademicYearsPage />} />
              <Route path="academics/shifts" element={<ShiftsPage />} />
              <Route path="academics/working-days" element={<WorkingDaysPage />} />
              <Route path="academics/period-slots" element={<PeriodSlotsPage />} />
              <Route path="academics/departments" element={<DepartmentsPage />} />
              <Route path="academics/semesters" element={<SemestersPage />} />
              <Route path="academics/sections" element={<SectionsPage />} />
              <Route path="academics/subjects" element={<SubjectsPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
