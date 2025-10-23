using BarbeariaGalileu.Server.Models;

namespace BarbeariaGalileu.Server.Services;

public interface IHaircutService
{
    IReadOnlyCollection<HaircutOption> List();
    HaircutOption? GetById(string id);
}

public class HaircutService : IHaircutService
{
    private static readonly IReadOnlyList<HaircutOption> HaircutOptions = new List<HaircutOption>
    {
        new()
        {
            Id = "corte-maquina",
            Name = "Corte Maquina",
            Description = "Corte com maquina em todo o cabelo. Valor R$25,00.",
            DurationMinutes = 30,
        },
        new()
        {
            Id = "corte-infantil",
            Name = "Corte Infantil",
            Description = "Corte pensado para criancas, com acabamento suave. Valor R$30,00.",
            DurationMinutes = 30,
        },
        new()
        {
            Id = "corte-tradicional",
            Name = "Corte Tradicional",
            Description = "Corte classico com maquina e tesoura. Valor R$35,00.",
            DurationMinutes = 30,
        },
        new()
        {
            Id = "corte-degrade",
            Name = "Corte Degrade",
            Description = "Degrade moderno com transicoes suaves e acabamento preciso. Valor R$40,00.",
            DurationMinutes = 30,
        },
        new()
        {
            Id = "barba-expressa",
            Name = "Barba Expressa",
            Description = "Limpeza e alinhamento rapido da barba. Valor R$25,00.",
            DurationMinutes = 30,
        },
        new()
        {
            Id = "barboterapia",
            Name = "Barboterapia",
            Description = "Tratamento completo com toalha quente e hidratacao. Valor R$30,00.",
            DurationMinutes = 45,
        },
        new()
        {
            Id = "sombrancelha",
            Name = "Sombrancelha",
            Description = "Design e alinhamento da sombrancelha. Valor R$10,00.",
            DurationMinutes = 20,
        },
        new()
        {
            Id = "combo-corte-barba",
            Name = "Combo Corte e Barba",
            Description = "Pacote completo com corte tradicional e barba. Valor R$60,00.",
            DurationMinutes = 60,
        },
        new()
        {
            Id = "combo-corte-barba-sombrancelha",
            Name = "Corte e Barba + Sombrancelha",
            Description = "Combo com corte tradicional, barba e sombrancelha. Valor R$65,00.",
            DurationMinutes = 60,
        },
        new()
        {
            Id = "combo-corte-sombrancelha",
            Name = "Corte + Sombrancelha",
            Description = "Corte tradicional acompanhado do design de sombrancelha. Valor R$45,00.",
            DurationMinutes = 60,
        },
    };

    public IReadOnlyCollection<HaircutOption> List() => HaircutOptions;

    public HaircutOption? GetById(string id) =>
        HaircutOptions.FirstOrDefault(option => option.Id.Equals(id, StringComparison.OrdinalIgnoreCase));
}
