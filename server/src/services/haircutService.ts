import type { HaircutOption } from '../types/haircut.js';

const haircutOptions: HaircutOption[] = [
  {
    id: 'corte-maquina',
    name: 'Corte Maquina',
    description: 'Corte com maquina em todo o cabelo. Valor R$25,00.',
    durationMinutes: 30,
    priceCents: 2500,
  },
  {
    id: 'corte-infantil',
    name: 'Corte Infantil',
    description: 'Corte pensado para criancas, com acabamento suave. Valor R$30,00.',
    durationMinutes: 30,
    priceCents: 3000,
  },
  {
    id: 'corte-tradicional',
    name: 'Corte Tradicional',
    description: 'Corte classico com maquina e tesoura. Valor R$35,00.',
    durationMinutes: 30,
    priceCents: 3500,
  },
  {
    id: 'corte-degrade',
    name: 'Corte Degrade',
    description: 'Degrade moderno com transicoes suaves e acabamento preciso. Valor R$40,00.',
    durationMinutes: 30,
    priceCents: 4000,
  },
  {
    id: 'barba-expressa',
    name: 'Barba Expressa',
    description: 'Limpeza e alinhamento rapido da barba. Valor R$25,00.',
    durationMinutes: 30,
    priceCents: 2500,
  },
  {
    id: 'barboterapia',
    name: 'Barboterapia',
    description: 'Tratamento completo com toalha quente e hidratacao. Valor R$30,00.',
    durationMinutes: 45,
    priceCents: 3000,
  },
  {
    id: 'sombrancelha',
    name: 'Sombrancelha',
    description: 'Design e alinhamento da sombrancelha. Valor R$10,00.',
    durationMinutes: 20,
    priceCents: 1000,
  },
  {
    id: 'combo-corte-barba',
    name: 'Combo Corte e Barba',
    description: 'Pacote completo com corte tradicional e barba. Valor R$60,00.',
    durationMinutes: 60,
    priceCents: 6000,
  },
  {
    id: 'combo-corte-barba-sombrancelha',
    name: 'Corte e Barba + Sombrancelha',
    description: 'Combo com corte tradicional, barba e sombrancelha. Valor R$65,00.',
    durationMinutes: 60,
    priceCents: 6500,
  },
  {
    id: 'combo-corte-sombrancelha',
    name: 'Corte + Sombrancelha',
    description: 'Corte tradicional acompanhado do design de sombrancelha. Valor R$45,00.',
    durationMinutes: 60,
    priceCents: 4500,
  },
];

export function listHaircutOptions(): HaircutOption[] {
  return haircutOptions;
}

export function getHaircutById(id: string): HaircutOption | undefined {
  return haircutOptions.find((option) => option.id === id);
}
