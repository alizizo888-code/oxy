import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import TeamLogin from '../components/TeamLogin'
import { useTeamRole } from '../hooks/useTeamRole'
import { TEAM_ROLES } from '../constants'
import StaffDashboard from './StaffDashboard'
import OperationsRoom from './OperationsRoom'
import TechRadar from './TechRadar'

export default function StaffGate() {
  const navigate = useNavigate()
  const { loading, signedIn, role, isOwner, refresh } = useTeamRole()

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm bg-[#090c14]" dir="rtl">
        جارِ التحقق…
      </div>
    )
  }

  if (!signedIn) {
    return (
      <div className="h-full relative" dir="rtl">
        <button
          onClick={() => navigate('/')}
          className="absolute top-[calc(env(safe-area-inset-top,0px)+1rem)] right-4 z-30 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
        >
          <ChevronRight size={18} className="text-white" />
        </button>
        <TeamLogin
          fullScreen
          appName="مُتقن"
          bgClassName="bg-[#090c14]"
          labels={{
            title: 'دخول فريق العمل',
            username: 'اسم المستخدم',
            password: 'كلمة المرور',
            submit: 'دخول',
          }}
          onSignedIn={() => refresh()}
        />
      </div>
    )
  }

  // Route each role to its own workspace.
  if (role === 'operations') return <OperationsRoom />
  if (role === 'technician') return <TechRadar />
  return <StaffDashboard roles={TEAM_ROLES} />
}
