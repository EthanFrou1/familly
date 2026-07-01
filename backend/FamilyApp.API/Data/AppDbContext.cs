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
    public DbSet<DuplicateCandidate> DuplicateCandidates => Set<DuplicateCandidate>();
    public DbSet<ExternalMedia> ExternalMedias => Set<ExternalMedia>();
    public DbSet<Album> Albums => Set<Album>();
    public DbSet<TimelineEvent> TimelineEvents => Set<TimelineEvent>();
    public DbSet<TimelineEventMember> TimelineEventMembers => Set<TimelineEventMember>();
    public DbSet<GameResult> GameResults => Set<GameResult>();

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
            e.HasOne(m => m.DelegateManager).WithMany().HasForeignKey(m => m.DelegateManagerId).IsRequired(false).OnDelete(DeleteBehavior.SetNull);
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

        b.Entity<Album>(e =>
        {
            e.HasKey(a => a.Id);
            e.Property(a => a.Name).HasMaxLength(100).IsRequired();
            e.HasOne(a => a.Creator).WithMany().HasForeignKey(a => a.CreatorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(a => a.Event).WithMany().HasForeignKey(a => a.EventId).IsRequired(false).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Photo>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.Category).HasConversion<string>();
            e.HasOne(p => p.Uploader).WithMany(m => m.Photos).HasForeignKey(p => p.UploaderId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(p => p.Event).WithMany(ev => ev.Photos).HasForeignKey(p => p.EventId).IsRequired(false);
            e.HasOne(p => p.Album).WithMany(a => a.Photos).HasForeignKey(p => p.AlbumId).IsRequired(false).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Event>(e =>
        {
            e.HasKey(ev => ev.Id);
            e.Property(ev => ev.Type).HasConversion<string>();
            e.HasOne(ev => ev.CreatedBy).WithMany().HasForeignKey(ev => ev.CreatedById).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<DuplicateCandidate>(e =>
        {
            e.HasKey(d => d.Id);
            e.HasOne(d => d.MemberA).WithMany().HasForeignKey(d => d.MemberAId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(d => d.MemberB).WithMany().HasForeignKey(d => d.MemberBId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(d => new { d.MemberAId, d.MemberBId }).IsUnique();
            e.Property(d => d.Confidence).HasMaxLength(20);
            e.Property(d => d.Status).HasMaxLength(20);
        });

        b.Entity<ExternalMedia>(e =>
        {
            e.HasKey(em => em.Id);
            e.Property(em => em.Platform).HasConversion<string>();
            e.HasOne(em => em.Uploader).WithMany().HasForeignKey(em => em.UploaderId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(em => em.Event).WithMany().HasForeignKey(em => em.EventId).IsRequired(false);
            e.HasOne(em => em.LinkedMember).WithMany().HasForeignKey(em => em.LinkedMemberId).IsRequired(false).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<TimelineEvent>(e =>
        {
            e.HasKey(te => te.Id);
            e.Property(te => te.Title).HasMaxLength(200).IsRequired();
            e.Property(te => te.Type).HasConversion<string>();
            e.HasOne(te => te.CreatedBy).WithMany().HasForeignKey(te => te.CreatedById).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(te => te.Family).WithMany().HasForeignKey(te => te.FamilyId).IsRequired(false).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<TimelineEventMember>(e =>
        {
            e.HasKey(tem => new { tem.TimelineEventId, tem.MemberId });
            e.HasOne(tem => tem.TimelineEvent).WithMany(te => te.LinkedMembers).HasForeignKey(tem => tem.TimelineEventId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(tem => tem.Member).WithMany().HasForeignKey(tem => tem.MemberId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
