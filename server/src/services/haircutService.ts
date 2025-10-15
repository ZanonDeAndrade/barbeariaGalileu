import type { HaircutOption } from '../types/haircut.js';

const haircutOptions: HaircutOption[] = [
  {
    id: 'classic',
    name: 'Corte Clássico',
    description: 'Corte tradicional com acabamento na tesoura e navalha.',
    durationMinutes: 60,
  },
  {
    id: 'fade',
    name: 'Corte Fade',
    description: 'Fade moderno com transições suaves e acabamento preciso.',
    durationMinutes: 60,
  },
  {
    id: 'beard',
    name: 'Barba Completa',
    description: 'Design, alinhamento e hidratação completa da barba.',
    durationMinutes: 45,
  },
  {
    id: 'combo',
    name: 'Corte + Barba',
    description: 'Experiência completa para cabelo e barba com cuidados premium.',
    durationMinutes: 90,
  },
];

export function listHaircutOptions(): HaircutOption[] {
  return haircutOptions;
}

export function getHaircutById(id: string): HaircutOption | undefined {
  return haircutOptions.find((option) => option.id === id);
}
