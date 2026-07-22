using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FamilyApp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddFamilleEnOr : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FamilleEnOrAnswerGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionKey = table.Column<string>(type: "text", nullable: false),
                    Label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FamilleEnOrAnswerGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FamilleEnOrQuestionStates",
                columns: table => new
                {
                    QuestionKey = table.Column<string>(type: "text", nullable: false),
                    IsReady = table.Column<bool>(type: "boolean", nullable: false),
                    ReadyAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FamilleEnOrQuestionStates", x => x.QuestionKey);
                });

            migrationBuilder.CreateTable(
                name: "FamilleEnOrAnswers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionKey = table.Column<string>(type: "text", nullable: false),
                    MemberId = table.Column<Guid>(type: "uuid", nullable: false),
                    RawText = table.Column<string>(type: "text", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FamilleEnOrAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FamilleEnOrAnswers_FamilleEnOrAnswerGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "FamilleEnOrAnswerGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_FamilleEnOrAnswers_Members_MemberId",
                        column: x => x.MemberId,
                        principalTable: "Members",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FamilleEnOrAnswers_GroupId",
                table: "FamilleEnOrAnswers",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_FamilleEnOrAnswers_MemberId",
                table: "FamilleEnOrAnswers",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_FamilleEnOrAnswers_QuestionKey_MemberId",
                table: "FamilleEnOrAnswers",
                columns: new[] { "QuestionKey", "MemberId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FamilleEnOrAnswers");

            migrationBuilder.DropTable(
                name: "FamilleEnOrQuestionStates");

            migrationBuilder.DropTable(
                name: "FamilleEnOrAnswerGroups");
        }
    }
}
