import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { useAuth } from './hooks/useAuth';
import Landing from './pages/Landing';
import Login from './pages/Login';
import University from './pages/University';
import Students from './pages/Students';
import Issue from './pages/Issue';
import History from './pages/History';
import Student from './pages/Student';
import Onboarding from './pages/Onboarding';
import Verify from './pages/Verify';
import { Feedback } from './components/Feedback';
function RoleGate({role,children,actual}:{role:'student'|'university';children:ReactNode;actual:string|null|undefined}){
  return actual===role ? <>{children}</>:<Navigate to="/login" replace/>;
}
export default function App() {
  const auth=useAuth();
  return <Shell profile={auth.profile}>
    {auth.loading ? <div className="py-20 text-center text-slate-500">Loading authenticated account…</div> : <>
      {auth.error&&<Feedback kind="error" message={auth.error}/>}
      <Routes>
        <Route path="/" element={<Landing/>}/><Route path="/login" element={<Login/>}/>
        <Route path="/verify" element={<Verify/>}/>
        <Route path="/university" element={<RoleGate role="university" actual={auth.profile?.role}><University/></RoleGate>}/>
        <Route path="/university/students" element={<RoleGate role="university" actual={auth.profile?.role}><Students/></RoleGate>}/>
        <Route path="/university/issue" element={<RoleGate role="university" actual={auth.profile?.role}><Issue/></RoleGate>}/>
        <Route path="/university/history" element={<RoleGate role="university" actual={auth.profile?.role}><History/></RoleGate>}/>
        <Route path="/student" element={<RoleGate role="student" actual={auth.profile?.role}><Student profile={auth.profile!}/></RoleGate>}/>
        <Route path="/student/onboarding" element={<RoleGate role="student" actual={auth.profile?.role}><Onboarding profile={auth.profile!} refresh={auth.refresh}/></RoleGate>}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </>}
  </Shell>;
}
