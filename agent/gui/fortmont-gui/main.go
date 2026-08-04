package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	agentService := NewAgentService()
	app := application.New(application.Options{
		Name:        "Fortmont Cloud Control",
		Description: "Native desktop control surface for the Fortmont agent",
		Services: []application.Service{
			application.NewService(agentService),
		},
		Assets: application.AssetOptions{Handler: application.AssetFileServerFS(assets)},
		Mac:    application.MacOptions{ApplicationShouldTerminateAfterLastWindowClosed: true},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "Fortmont Cloud Control",
		Width:            1420,
		Height:           900,
		MinWidth:         980,
		MinHeight:        680,
		BackgroundColour: application.NewRGB(9, 13, 22),
		URL:              "/",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 44,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
