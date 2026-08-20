import { Router } from 'express';
import {
  cancelAppointmentHandler,
  cancelAppointmentByCustomerHandler,
  createAppointmentHandler,
  getAvailabilityHandler,
  listAppointmentsByPhoneHandler,
  listAppointmentsHandler,
  rescheduleAppointmentHandler,
} from '../controllers/appointments.controller.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { requireBarber } from '../middlewares/requireBarber.js';

const router = Router();

// Classificacao de cada rota (ver README de seguranca no topo do arquivo de
// middleware): PUBLIC = necessaria para o fluxo de reserva do cliente;
// CUSTOMER = exige posse do telefone do agendamento; BARBER = area interna.

// PUBLIC: grade de horarios livres/ocupados, sem qualquer dado pessoal.
router.get('/availability', getAvailabilityHandler);

// CUSTOMER: identidade derivada do telefone informado (ver limitacoes no
// relatorio de seguranca). Rate limit obrigatorio por ser enumeravel.
router.post(
  '/by-phone',
  rateLimit({ windowMs: 10 * 60 * 1000, max: 30 }),
  listAppointmentsByPhoneHandler,
);

// BARBER: lista completa da agenda, com nome, telefone e observacoes de todos
// os clientes. Nunca pode ser publica.
router.get('/', requireBarber, listAppointmentsHandler);

// PUBLIC: criacao de reserva pelo cliente.
router.post('/', rateLimit({ windowMs: 10 * 60 * 1000, max: 20 }), createAppointmentHandler);

// BARBER: cancelamento administrativo de qualquer agendamento.
router.patch('/:id/cancel', requireBarber, cancelAppointmentHandler);

// CUSTOMER: cancelamento/reagendamento com verificacao de ownership no service.
router.patch(
  '/:id/cancel-by-customer',
  rateLimit({ windowMs: 10 * 60 * 1000, max: 30 }),
  cancelAppointmentByCustomerHandler,
);
router.post(
  '/:id/reschedule',
  rateLimit({ windowMs: 10 * 60 * 1000, max: 30 }),
  rescheduleAppointmentHandler,
);

export default router;
