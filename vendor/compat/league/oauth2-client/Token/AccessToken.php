<?php

namespace League\OAuth2\Client\Token;

class AccessToken
{
    private string $token;
    private ?int $expires;

    public function __construct(array $options = [])
    {
        $this->token = (string) ($options['access_token'] ?? '');
        $this->expires = isset($options['expires']) ? (int) $options['expires'] : null;
    }

    public function hasExpired(): bool
    {
        return $this->expires !== null && $this->expires <= time();
    }

    public function __toString(): string
    {
        return $this->token;
    }
}
