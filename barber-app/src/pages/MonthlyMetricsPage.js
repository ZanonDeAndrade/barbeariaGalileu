import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { format } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
const currentMonth = format(new Date(), 'yyyy-MM');
const monthLabels = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
];
function parseMonthValue(value) {
    const match = value.match(/^(\d{4})-(\d{2})$/);
    if (!match)
        return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12)
        return null;
    return new Date(year, month - 1, 1);
}
function formatMonthLabel(value) {
    const parsed = parseMonthValue(value);
    if (!parsed)
        return value;
    return `${monthLabels[parsed.getMonth()]}/${parsed.getFullYear()}`;
}
function buildMonthOptions(referenceMonth) {
    const referenceDate = parseMonthValue(referenceMonth) ?? new Date();
    const options = [];
    for (let diff = 12; diff >= -24; diff -= 1) {
        const date = new Date(referenceDate);
        date.setMonth(referenceDate.getMonth() + diff);
        const value = format(date, 'yyyy-MM');
        options.push({ value, label: formatMonthLabel(value) });
    }
    return options;
}
function MonthlyMetricsPage({ defaultMonth, onBack }) {
    const referenceMonth = defaultMonth ?? currentMonth;
    const [haircuts, setHaircuts] = useState([]);
    const [summaryMonth, setSummaryMonth] = useState(referenceMonth);
    const [includeCanceled, setIncludeCanceled] = useState(false);
    const [monthlySummary, setMonthlySummary] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [summaryError, setSummaryError] = useState(null);
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);
    const fetchHaircuts = async () => {
        try {
            const haircutList = await api.get('/haircuts');
            if (!isMountedRef.current)
                return;
            setHaircuts(haircutList.data);
        }
        catch (error) {
            console.error(error);
        }
    };
    const fetchMonthlySummary = async (options = {}) => {
        if (!summaryMonth) {
            setMonthlySummary(null);
            return;
        }
        const silent = options.silent ?? false;
        if (!silent) {
            setLoadingSummary(true);
            setSummaryError(null);
        }
        try {
            const response = await api.get('/barber/dashboard/appointments-summary', {
                params: {
                    month: summaryMonth,
                    includeCanceled: includeCanceled ? 'true' : 'false',
                },
            });
            if (!isMountedRef.current)
                return;
            setMonthlySummary(response.data);
        }
        catch (error) {
            console.error(error);
            if (!silent && isMountedRef.current) {
                setSummaryError('Falha ao carregar as métricas mensais.');
            }
        }
        finally {
            if (!silent && isMountedRef.current) {
                setLoadingSummary(false);
            }
        }
    };
    useEffect(() => {
        fetchHaircuts();
    }, []);
    useEffect(() => {
        fetchMonthlySummary();
    }, [summaryMonth, includeCanceled]);
    const haircutMap = useMemo(() => Object.fromEntries(haircuts.map((item) => [item.id, item.name])), [haircuts]);
    const monthOptions = useMemo(() => buildMonthOptions(referenceMonth), [referenceMonth]);
    return (_jsxs("div", { className: "content-grid", children: [_jsx("section", { children: _jsx("button", { type: "button", className: "btn btn-secondary", onClick: onBack, children: "Voltar" }) }), _jsxs("section", { children: [_jsx("h1", { className: "page-title", children: "M\u00E9tricas mensais" }), _jsx("p", { className: "page-subtitle", children: "Total e distribui\u00E7\u00E3o de agendamentos no m\u00EAs (America/Sao_Paulo)." })] }), _jsxs("section", { className: "card card--dark", children: [_jsxs("div", { className: "flex-between", style: { alignItems: 'flex-start', gap: '0.75rem' }, children: [_jsxs("div", { children: [_jsx("div", { className: "section-title", children: "Resumo do m\u00EAs" }), _jsx("p", { style: { color: 'var(--color-text-muted)', fontSize: '0.9rem' }, children: "Selecione o m\u00EAs para consultar os totais." })] }), _jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => fetchMonthlySummary(), disabled: loadingSummary, children: "Atualizar" })] }), _jsxs("div", { className: "form-grid", style: { marginTop: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }, children: [_jsxs("label", { children: ["M\u00EAs", _jsx("select", { value: summaryMonth, onChange: (event) => setSummaryMonth(event.target.value), children: monthOptions.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsxs("label", { style: { display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1.75rem' }, children: [_jsx("input", { type: "checkbox", checked: includeCanceled, onChange: (event) => setIncludeCanceled(event.target.checked) }), "Incluir cancelados"] })] }), loadingSummary ? (_jsx("div", { className: "status-banner", style: { marginTop: '1rem' }, children: "Carregando m\u00E9tricas..." })) : summaryError ? (_jsx("div", { className: "status-banner error", style: { marginTop: '1rem' }, children: summaryError })) : monthlySummary ? (_jsxs("div", { style: { marginTop: '1.25rem' }, children: [_jsxs("div", { className: "status-banner", style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }, children: [_jsx("div", { children: "Total no m\u00EAs" }), _jsx("strong", { children: monthlySummary.total })] }), _jsx("div", { style: {
                                    marginTop: '1rem',
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                                    gap: '1rem',
                                }, children: _jsxs("div", { children: [_jsx("div", { className: "section-title", children: "Por servi\u00E7o" }), monthlySummary.byService.length === 0 ? (_jsx("div", { className: "status-banner", style: { marginTop: '0.75rem' }, children: "Sem dados." })) : (_jsx("div", { className: "table-responsive", style: { marginTop: '0.75rem' }, children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Servi\u00E7o" }), _jsx("th", { children: "Qtd" })] }) }), _jsx("tbody", { children: monthlySummary.byService.map((item) => (_jsxs("tr", { children: [_jsx("td", { "data-label": "Servi\u00E7o", children: haircutMap[item.haircutType] ?? item.haircutType }), _jsx("td", { "data-label": "Qtd", children: item.count })] }, item.haircutType))) })] }) }))] }) })] })) : (_jsx("div", { className: "status-banner", style: { marginTop: '1rem' }, children: "Selecione um m\u00EAs para visualizar as m\u00E9tricas." }))] })] }));
}
export default MonthlyMetricsPage;
