using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FamilyApp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPushSubscriptionIsStandalone : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsStandalone",
                table: "PushSubscriptions",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsStandalone",
                table: "PushSubscriptions");
        }
    }
}
