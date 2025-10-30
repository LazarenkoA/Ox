package config

import (
	"github.com/creasty/defaults"
	"github.com/pkg/errors"
	"gopkg.in/yaml.v3"
	"os"
)

type WorkerConfig struct {
	Addr string
}

type Config struct {
	Port    int `yaml:"app_port"`
	Workers []WorkerConfig
}

func LoadConfig(filePath string) (*Config, error) {
	file, err := os.ReadFile(filePath)
	if err != nil {
		return nil, errors.Wrap(err, "open config")
	}

	conf := new(Config)
	if err := yaml.Unmarshal(file, conf); err != nil {
		return nil, errors.Wrap(err, "unmarshal error")
	}

	if err := defaults.Set(conf); err != nil {
		return nil, errors.Wrap(err, "set default error")
	}

	return conf, nil
}
