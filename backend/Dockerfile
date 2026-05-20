FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore — layer mis en cache tant que .csproj ne change pas
COPY FamilyApp.API/FamilyApp.API.csproj FamilyApp.API/
RUN dotnet restore FamilyApp.API/FamilyApp.API.csproj

# Build & publish
COPY . .
RUN dotnet publish FamilyApp.API/FamilyApp.API.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "FamilyApp.API.dll"]
