using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace StockFlow.API.Filters;

public class RequireAdminAttribute : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext context)
    {
        var role = context.HttpContext.Request.Headers["X-User-Role"].ToString();
        if (!string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
            context.Result = new ObjectResult(new { error = "Admin access required." }) { StatusCode = 403 };
    }
}
