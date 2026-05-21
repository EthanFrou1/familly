using FamilyApp.API.Data;
using FamilyApp.API.Models;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Services;

public class RelationValidationService(AppDbContext db)
{
    public async Task<string?> ValidateAsync(Guid memberAId, Guid memberBId, RelationType type)
    {
        if (memberAId == memberBId)
            return "Un membre ne peut pas avoir une relation avec lui-même.";

        var a = await db.Members.FindAsync(memberAId);
        var b = await db.Members.FindAsync(memberBId);
        if (a is null || b is null)
            return "Un ou plusieurs membres sont introuvables.";

        var existing = await db.Relations
            .Where(r => (r.MemberAId == memberAId && r.MemberBId == memberBId) ||
                        (r.MemberAId == memberBId && r.MemberBId == memberAId))
            .ToListAsync();

        bool hasParentChild = existing.Any(r => r.Type == RelationType.ParentChild);
        bool hasSpouse      = existing.Any(r => r.Type == RelationType.Spouse);
        bool hasSibling     = existing.Any(r =>
            r.Type == RelationType.Sibling || r.Type == RelationType.HalfSibling);

        switch (type)
        {
            case RelationType.ParentChild:
                if (hasSpouse)
                    return "Ces membres sont déjà enregistrés comme conjoints — impossible d'ajouter un lien parent-enfant.";
                if (hasSibling)
                    return "Ces membres sont déjà enregistrés comme frères/sœurs — impossible d'ajouter un lien parent-enfant.";

                // Circular check: B is already parent of A
                bool circular = existing.Any(r =>
                    r.Type == RelationType.ParentChild &&
                    r.MemberAId == memberBId && r.MemberBId == memberAId);
                if (circular)
                    return "Relation circulaire : cet enfant est déjà enregistré comme parent du parent désigné.";

                // Age check (A = parent, B = child)
                if (a.BirthDate.HasValue && b.BirthDate.HasValue)
                {
                    var diffYears = (b.BirthDate.Value - a.BirthDate.Value).TotalDays / 365.25;
                    if (diffYears < 0)
                        return "Incohérence d'âge : le parent désigné est né après l'enfant.";
                    if (diffYears < 12)
                        return $"Incohérence d'âge : le parent doit avoir au moins 12 ans de plus que l'enfant (écart actuel : {diffYears:F0} an(s)).";
                }
                break;

            case RelationType.Spouse:
                if (hasParentChild)
                    return "Ces membres sont déjà dans une relation parent-enfant — impossible d'ajouter un lien conjugal.";
                if (hasSibling)
                    return "Ces membres sont déjà enregistrés comme frères/sœurs — impossible d'ajouter un lien conjugal.";
                break;

            case RelationType.Sibling:
            case RelationType.HalfSibling:
                if (hasParentChild)
                    return "Ces membres sont déjà dans une relation parent-enfant — impossible d'ajouter un lien frère/sœur.";
                if (hasSpouse)
                    return "Ces membres sont déjà enregistrés comme conjoints — impossible d'ajouter un lien frère/sœur.";
                break;
        }

        return null;
    }

    public static string? ValidateDates(DateTime? birthDate, DateTime? deathDate, bool isAlive)
    {
        var now = DateTime.UtcNow;

        if (birthDate.HasValue && birthDate.Value > now)
            return "La date de naissance ne peut pas être dans le futur.";

        if (deathDate.HasValue && deathDate.Value > now)
            return "La date de décès ne peut pas être dans le futur.";

        if (birthDate.HasValue && deathDate.HasValue && deathDate.Value < birthDate.Value)
            return "La date de décès ne peut pas être antérieure à la date de naissance.";

        if (isAlive && deathDate.HasValue)
            return "Un membre vivant ne peut pas avoir une date de décès. Désactivez le statut 'vivant' d'abord.";

        if (!isAlive && birthDate.HasValue && deathDate.HasValue)
        {
            var age = (deathDate.Value - birthDate.Value).TotalDays / 365.25;
            if (age > 130)
                return "La durée de vie semble incohérente (plus de 130 ans).";
        }

        return null;
    }
}
