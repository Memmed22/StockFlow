using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockFlow.API.Migrations
{
    /// <inheritdoc />
    public partial class AddStockMovementCreatedAtIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_CreatedAt",
                table: "StockMovements",
                column: "CreatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_StockMovements_CreatedAt",
                table: "StockMovements");
        }
    }
}
