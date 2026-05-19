using FamilyApp.API.Models;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Member> Members => Set<Member>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Relation> Relations => Set<Relation>();
    public DbSet<Photo> Photos => Set<Photo>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<Family> Families => Set<Family>();
    public DbSet<AppSettings> AppSettings => Set<AppSettings>();
    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();
    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<AppSettings>(e =>
        {
            e.HasKey(s => s.Id);
            e.Property(s => s.FamilyGroupName).HasMaxLength(100);
            e.HasData(new AppSettings { Id = 1, FamilyGroupName = null });
        });

        b.Entity<Family>(e =>
        {
            e.HasKey(f => f.Id);
            e.Property(f => f.Name).HasMaxLength(100).IsRequired();
        });

        b.Entity<Member>(e =>
        {
            e.HasKey(m => m.Id);
            e.Property(m => m.FirstName).HasMaxLength(100).IsRequired();
            e.Property(m => m.LastName).HasMaxLength(100).IsRequired();
            e.HasOne(m => m.User).WithOne(u => u.Member).HasForeignKey<User>(u => u.MemberId);
            e.HasOne(m => m.Family).WithMany(f => f.Members).HasForeignKey(m => m.FamilyId).IsRequired(false).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<User>(e =>
        {
            e.HasKey(u => u.Id);
            e.HasIndex(u => u.Email).IsUnique();
            e.HasIndex(u => u.InvitationToken).IsUnique();
            e.Property(u => u.Role).HasConversion<string>();
        });

        b.Entity<Relation>(e =>
        {
            e.HasKey(r => r.Id);
            e.Property(r => r.Type).HasConversion<string>();
            e.HasOne(r => r.MemberA).WithMany(m => m.RelationsAsA).HasForeignKey(r => r.MemberAId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(r => r.MemberB).WithMany(m => m.RelationsAsB).HasForeignKey(r => r.MemberBId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Photo>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.Category).HasConversion<string>();
            e.HasOne(p => p.Uploader).WithMany(m => m.Photos).HasForeignKey(p => p.UploaderId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(p => p.Event).WithMany(ev => ev.Photos).HasForeignKey(p => p.EventId).IsRequired(false);
        });

        b.Entity<Event>(e =>
        {
            e.HasKey(ev => ev.Id);
            e.Property(ev => ev.Type).HasConversion<string>();
            e.HasOne(ev => ev.CreatedBy).WithMany().HasForeignKey(ev => ev.CreatedById).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
