using System.Collections.Concurrent;

namespace FamilyApp.API.Realtime;

public class GameSessionStore
{
    private const string CodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I
    private readonly ConcurrentDictionary<string, GameSession> _sessions = new();

    public GameSession Create(string gameType)
    {
        var code = GenerateUniqueCode();
        var session = new GameSession { Code = code, GameType = gameType };
        _sessions[code] = session;
        return session;
    }

    public GameSession? Get(string code) => _sessions.GetValueOrDefault(code.ToUpperInvariant());

    public void Remove(string code) => _sessions.TryRemove(code.ToUpperInvariant(), out _);

    public GameSession? FindByConnectionId(string connectionId) =>
        _sessions.Values.FirstOrDefault(s => s.Players.Any(p => p.ConnectionId == connectionId));

    private string GenerateUniqueCode()
    {
        string code;
        do
        {
            code = new string([.. Enumerable.Range(0, 5).Select(_ => CodeChars[Random.Shared.Next(CodeChars.Length)])]);
        } while (_sessions.ContainsKey(code));
        return code;
    }
}
