using FamilyApp.API.Models;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Data;

public static class DataSeeder
{
    public static async Task SeedAsync(AppDbContext db, IConfiguration config)
    {
        var email = config["Seed:AdminEmail"];
        if (string.IsNullOrEmpty(email)) return;

        var alreadyExists = await db.Users.AnyAsync(u => u.Email == email);
        if (alreadyExists) return;

        var password = config["Seed:AdminPassword"]!;
        var firstName = config["Seed:AdminFirstName"] ?? "Admin";
        var lastName = config["Seed:AdminLastName"] ?? "";

        var member = new Member
        {
            FirstName = firstName,
            LastName = lastName,
            IsAlive = true
        };
        db.Members.Add(member);
        await db.SaveChangesAsync();

        var user = new User
        {
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = UserRole.Admin,
            MemberId = member.Id
        };
        db.Users.Add(user);

        // Lier le membre à son compte
        member.UserId = user.Id;

        await db.SaveChangesAsync();

        Console.WriteLine($"[Seed] Admin créé : {email}");
    }
}
