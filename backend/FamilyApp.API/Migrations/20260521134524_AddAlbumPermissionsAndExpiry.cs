using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FamilyApp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAlbumPermissionsAndExpiry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AllowMemberUploads",
                table: "Albums",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "ExpiresAt",
                table: "Albums",
                type: "timestamp with time zone",
                nullable: true);

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AllowMemberUploads",
                table: "Albums");

            migrationBuilder.DropColumn(
                name: "ExpiresAt",
                table: "Albums");
        }
    }
}
