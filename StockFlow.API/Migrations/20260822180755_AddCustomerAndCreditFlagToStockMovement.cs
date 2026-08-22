using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockFlow.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerAndCreditFlagToStockMovement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CustomerId",
                table: "StockMovements",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsCreditReturn",
                table: "StockMovements",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_CustomerId",
                table: "StockMovements",
                column: "CustomerId");

            migrationBuilder.AddForeignKey(
                name: "FK_StockMovements_Customers_CustomerId",
                table: "StockMovements",
                column: "CustomerId",
                principalTable: "Customers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StockMovements_Customers_CustomerId",
                table: "StockMovements");

            migrationBuilder.DropIndex(
                name: "IX_StockMovements_CustomerId",
                table: "StockMovements");

            migrationBuilder.DropColumn(
                name: "CustomerId",
                table: "StockMovements");

            migrationBuilder.DropColumn(
                name: "IsCreditReturn",
                table: "StockMovements");
        }
    }
}
