FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY FamilyApp.API.csproj .
RUN dotnet restore

COPY . .
RUN dotnet publish --no-restore -c Release -o /app/out

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/out .

EXPOSE 8080
CMD ASPNETCORE_URLS=http://+:${PORT:-8080} ./FamilyApp.API
