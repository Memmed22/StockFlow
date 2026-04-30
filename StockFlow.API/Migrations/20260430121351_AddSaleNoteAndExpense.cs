using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockFlow.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSaleNoteAndExpense : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "Sales",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Note",
                table: "Sales");
        }
    }
}
