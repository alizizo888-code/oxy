import { useCallback } from 'react'
import { db } from '../lib/db'
import { push } from '../lib/push'
import { maps } from '../lib/maps'
import { pickTechnician } from '../assignment'
import { SPECIALTIES } from '../constants'
import { notify } from '../notify'

const specLabel = (id) => SPECIALTIES.find((s) => s.id === id)?.label || 'خدمة'

// Assignment actions shared by the operations room and the technician radar.
// All notifications to technicians use the loud "bell" sound (vibration on by default).
export function useAssignment({ profiles, settings, orders }) {
  const linkTech = useCallback(async (order, tech, by = 'auto') => {
    await db.updateShared('orders', order.id, {
      technicianId: tech.userId,
      technicianName: tech.displayName || tech.name || 'فني',
      assignedAt: new Date().toISOString(),
      forced: false,
      status: 'assigned',
      handler: 'technician',
      transferLog: [...(order.transferLog || []), { from: order.handler || 'operations', to: 'technician', at: new Date().toISOString(), by: by, note: tech.displayName || '' }],
      statusHistory: [...(order.statusHistory || []), { status: 'assigned', at: new Date().toISOString(), by }],
    })
    notify('assigned', { ...order, technicianId: tech.userId, technicianName: tech.displayName || tech.name || 'فني', status: 'assigned' }).catch(() => {})
  }, [])

  const forceOrder = useCallback(async (order, gid) => {
    await db.updateShared('orders', order.id, {
      forced: true,
      status: 'forced',
      statusHistory: [...(order.statusHistory || []), { status: 'forced', at: new Date().toISOString(), by: 'auto' }],
    })
    try {
      await push.sendToRole(gid, 'technician', {
        title: 'مهمة إجبارية متاحة',
        body: `${specLabel(order.specialtyId)} — ${order.clientName} · بانتظار قبول فني`,
        url: '#/staff/radar',
        sound: 'bell',
      })
    } catch {}
  }, [])

  const autoAssignOrder = useCallback(async (order, gid) => {
    const tech = pickTechnician(order, profiles, orders, {
      strategy: settings?.strategy || 'nearest',
      distanceFn: maps.distance,
    })
    if (tech) await linkTech(order, tech)
    else await forceOrder(order, gid)
    return tech
  }, [profiles, orders, settings, linkTech, forceOrder])

  return { linkTech, forceOrder, autoAssignOrder }
}
