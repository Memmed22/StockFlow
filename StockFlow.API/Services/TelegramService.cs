using System.Text.Json;

namespace StockFlow.API.Services;

public class TelegramService(IConfiguration config)
{
    private static readonly HttpClient _client = new();

    public async Task<string?> SendMessageAsync(string text)
    {
        var token = config["Telegram:BotToken"];
        var chatId = config["Telegram:ChatId"];

        if (string.IsNullOrWhiteSpace(token) || token == "YOUR_BOT_TOKEN"
            || string.IsNullOrWhiteSpace(chatId) || chatId == "YOUR_CHAT_ID")
            return "Telegram not configured.";

        try
        {
            var payload = JsonSerializer.Serialize(new { chat_id = chatId, text });
            var content = new StringContent(payload, System.Text.Encoding.UTF8, "application/json");
            var response = await _client.PostAsync(
                $"https://api.telegram.org/bot{token}/sendMessage", content);
            var body = await response.Content.ReadAsStringAsync();
            return response.IsSuccessStatusCode ? null : $"Telegram error: {body}";
        }
        catch (Exception ex)
        {
            return $"Exception: {ex.Message}";
        }
    }
}
