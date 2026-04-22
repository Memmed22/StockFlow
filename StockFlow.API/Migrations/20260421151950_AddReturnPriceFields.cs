using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockFlow.API.Migrations
{
    /// <inheritdoc />
    public partial class AddReturnPriceFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "BasePrice",
                table: "StockMovements",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ReturnPrice",
                table: "StockMovements",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BasePrice",
                table: "StockMovements");

            migrationBuilder.DropColumn(
                name: "ReturnPrice",
                table: "StockMovements");
        }
    }
}
