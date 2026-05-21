using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FamilyApp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDelegateManagerToMember : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DelegateManagerId",
                table: "Members",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Members_DelegateManagerId",
                table: "Members",
                column: "DelegateManagerId");

            migrationBuilder.AddForeignKey(
                name: "FK_Members_Users_DelegateManagerId",
                table: "Members",
                column: "DelegateManagerId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Members_Users_DelegateManagerId",
                table: "Members");

            migrationBuilder.DropIndex(
                name: "IX_Members_DelegateManagerId",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "DelegateManagerId",
                table: "Members");
        }
    }
}
