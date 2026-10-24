<?php

/**
 * ApiMailer.php
 *
 * Interfaccia per invio e-mail tramite servizi di Mail API.
 *
 * @author Marcello 'John Doe' Puri
 */
class ApiMailer
{
	const SERVICE_BREVO = 'brevo';
	const SERVICE_MAILJET = 'mailjet';
	const SERVICE_SENDGRID = 'sendgrid';

	/**
	 * Servizio da utilizzare per l'invio
	 *
	 * @var string
	 */
	public $Service;

	/**
	 * API key per l'autenticazione
	 *
	 * @var string
	 */
	public $ApiKey = '';

	/**
	 * Campo From (indirizzo) della e-mail
	 *
	 * @var string
	 */
	public $From = '';

	/**
	 * Campo From (nome) della e-mail
	 *
	 * @var string
	 */
	public $FromName = '';

	/**
	 * Oggetto della e-mail
	 *
	 * @var string
	 */
	public $Subject = '';

	/**
	 * Corpo della e-mail
	 *
	 * @var string
	 */
	public $Body = '';

	/**
	 * Array dei destinatari
	 *
	 * @var array
	 */
	protected $to = [];

	/**
	 * Costruttore
	 *
	 * @param string $service Servizio da utilizzare per l'invio
	 */
	public function __construct($service)
	{
		$this->Service = $service;
	}

	/**
	 * Imposta campi From e FromName
	 *
	 * @param string $address
	 * @param string $name
	 */
	public function setFrom($address, $name = '')
	{
		$this->From = $address;
		$this->FromName = $name;
	}

	/**
	 * Aggiunge un destinatario
	 *
	 * @param string $address
	 * @param string $name
	 * @return bool false se l'indirizzo è già stato specificato
	 */
	public function addAddress($address, $name = '')
	{
		if (!array_key_exists(strtolower($address), $this->to)) {
			$this->to[] = [$address, $name];
			return true;
		}
		return false;
	}

	/**
	 * Svuota elenco dei destinatari
	 */
	public function clearAddresses()
	{
		$this->to = [];
	}

	/**
	 * Crea messaggio e lo invia
	 *
	 * @throws Exception
	 */
	public function send()
	{
		switch ($this->Service) {
			case self::SERVICE_BREVO:
				$this->sendWithBrevo();
				break;
			case self::SERVICE_MAILJET:
				$this->sendWithMailJet();
				break;
			case self::SERVICE_SENDGRID:
				$this->sendWithSendGrid();
				break;
		}
	}

	/**
	 * Crea messaggio e lo invia utilizzando il servizio Brevo (ex SendInBlue)
	 *
	 * @throws Exception
	 */
	private function sendWithBrevo()
	{
		$makeAddress = function($parts) {
			return ApiMailer::makeAddress(['email', 'name'], $parts);
		};

		$endpoint = 'https://api.brevo.com/v3/smtp/email';
		$headers[] = 'accept: application/json';
		$headers[] = "api-key: $this->ApiKey";
		$headers[] = 'Content-Type: application/json';
		$body = [
			'sender' => call_user_func($makeAddress, [$this->From, $this->FromName]),
			'to' => array_map($makeAddress, $this->to),
			'subject' => $this->Subject,
			'textContent' => $this->Body
		];

		list($code, $response) = $this->doSend($endpoint, $headers, json_encode($body));
		if ($code >= 400) {
			$message = "Code $code";
			if (isset($response->message))
				$message .= " $response->message";
			throw new Exception($message);
		}
	}

	/**
	 * Crea messaggio e lo invia utilizzando il servizio MailJet
	 *
	 * @throws Exception
	 */
	private function sendWithMailJet()
	{
		$makeAddress = function($parts) {
			return ApiMailer::makeAddress(['Email', 'Name'], $parts);
		};

		$endpoint = 'https://api.mailjet.com/v3.1/send';
		$headers[] = 'Content-Type: application/json';
		$body = [
			'Messages' => [
				[
					'From' => call_user_func($makeAddress, [$this->From, $this->FromName]),
					'To' => array_map($makeAddress, $this->to),
					'Subject' => $this->Subject,
					'TextPart' => $this->Body,
				],
			]
		];

		list($code, $response) = $this->doSend($endpoint, $headers, json_encode($body), $this->ApiKey);
		if ($code >= 400) {
			$errorData = isset($response->Messages[0]->Errors[0]) ? $response->Messages[0]->Errors[0] : $response;
			$message = "Code $code";
			if (isset($errorData->ErrorRelatedTo))
				$message .= ' ' . join(', ', $errorData->ErrorRelatedTo) . ':';
			$message .= " $errorData->ErrorMessage";
			throw new Exception($message);
		}
	}

	/**
	 * Crea messaggio e lo invia utilizzando il servizio SendGrid
	 *
	 * @throws Exception
	 */
	private function sendWithSendGrid()
	{
		$makeAddress = function($parts) {
			return ApiMailer::makeAddress(['email', 'name'], $parts);
		};

		$endpoint = 'https://api.sendgrid.com/v3/mail/send';
		$headers[] = "Authorization: Bearer $this->ApiKey";
		$headers[] = 'Content-Type: application/json';
		$body = [
			'personalizations' => [
				[
					'to' => array_map($makeAddress, $this->to),
				]
			],
			'from' => call_user_func($makeAddress, [$this->From, $this->FromName]),
			'subject' => $this->Subject,
			'content' => [
				[
					'type' => 'text/plain',
					'value' => $this->Body
				]
			]
		];

		list($code, $response) = $this->doSend($endpoint, $headers, json_encode($body));
		if ($code >= 400) {
			$message = "Code $code";
			if (isset($response->errors)) {
				if (isset($response->errors[0]->field))
					$message .= " {$response->errors[0]->field}:";
				$message .= " {$response->errors[0]->message}";
			}
			throw new Exception($message);
		}
	}

	/**
	 * Crea oggetto che definisce il mittente o il destinatario
	 *
	 * @param array $keys
	 * @param array $parts
	 */
	private static function makeAddress($keys, $parts)
	{
		$address = array_combine($keys, $parts);
		if (empty($parts[1]))
			unset($address[$keys[1]]);
		return $address;
	}

	/**
	 * Esegue sessione cURL.
	 * Invia richiesta e attende risposta.
	 *
	 * @param string $endpoint
	 * @param array $headers
	 * @param string $body
	 * @param string $httpAuth
	 * @throws Exception
	 * @return array [HTTP response code, response]
	 */
	private function doSend($endpoint, $headers, $body, $httpAuth = '')
	{
		$handle = curl_init();
		if ($handle === false)
			throw new Exception("Errore inizializzazione sessione cURL");

		$options = [
			CURLOPT_CONNECTTIMEOUT => 10,
			CURLOPT_TIMEOUT => 30,
			CURLOPT_URL => $endpoint,
			CURLOPT_POST => true,
			CURLOPT_HTTPHEADER => $headers,
			CURLOPT_USERPWD => $httpAuth,
			CURLOPT_POSTFIELDS => $body,
			CURLOPT_RETURNTRANSFER => true,
		];
		if (curl_setopt_array($handle, $options) === false)
			throw new Exception("Errore configurazione sessione cURL");

		$response = curl_exec($handle);
		if ($response === false)
			throw new Exception("Errore esecuzione cURL");

		$code = curl_getinfo($handle, CURLINFO_HTTP_CODE);
		$response = json_decode($response);

		return [$code , $response];
	}
}
